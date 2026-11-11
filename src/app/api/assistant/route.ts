// Household assistant.
//
// GET  /api/assistant  → { enabled }   whether a model is configured
// POST /api/assistant  { question, history?, asker? } → { answer }
//
// The browser only sends the question. The household's data is read here with
// the member's own session (row-level security keeps it to their household),
// turned into a text snapshot and passed to the configured model. Read-only:
// the model has no tools and nothing is written. Questions, answers and
// household data are never logged.

import { cookies } from "next/headers";
import { createRateLimiter, parseAskRequest, type Turn } from "@/lib/assistant/limits";
import { askModel, assistantConfig, AssistantError, type AssistantFailure } from "@/lib/assistant/provider";
import { buildSnapshot, buildSystemPrompt, SNAPSHOT_DAYS_AHEAD } from "@/lib/assistant/snapshot";
import { getAppTimezone, getLocalDateTime } from "@/lib/local-time";
import { shortName } from "@/lib/new-item-push";
import { isSameOriginRequest } from "@/lib/request-security";
import { createSupabaseRouteClient } from "@/lib/supabase";
import { addDays } from "@/lib/work";

/** Room for a local model that has to load first; must fit the host's function limit. */
export const maxDuration = 60;

/** Give up a little before the platform does, so the reply is ours. */
const MODEL_TIMEOUT_MS = 55_000;
/** Multi-day events may have started before today; look this far back for them. */
const EVENT_LOOKBACK_DAYS = 60;
const MAX_ROWS = 2000;

const noStore = { "Cache-Control": "no-store" };
const perMinute = createRateLimiter(8, 60_000);
const perDay = createRateLimiter(200, 24 * 60 * 60 * 1000);

const FAILURES: Record<AssistantFailure, { status: number; error: string }> = {
  timeout: { status: 504, error: "That took too long. The assistant may still be starting up; try again in a moment." },
  unreachable: { status: 503, error: "The assistant isn't running right now. Try again later." },
  refused: { status: 200, error: "The assistant couldn't answer that one. Try asking another way." },
  empty: { status: 502, error: "The assistant didn't give an answer. Try again." },
  failed: { status: 502, error: "The assistant ran into a problem. Try again." },
};

function fail(status: number, error: string) {
  return Response.json({ error }, { status, headers: noStore });
}

function isValidTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  return Response.json({ enabled: assistantConfig() !== null }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return fail(403, "Forbidden");

  const config = assistantConfig();
  if (!config) return fail(503, "The assistant isn't set up.");

  const client = createSupabaseRouteClient(await cookies());
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return fail(401, "Sign in first.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Send valid JSON.");
  }
  const ask = parseAskRequest(body);
  if ("error" in ask) return fail(400, ask.error);

  if (!perMinute.allow(user.id) || !perDay.allow(user.id))
    return fail(429, "That's a lot of questions. Give it a minute and try again.");

  // Everything below is read with the member's own client, so RLS limits it
  // to their household. The explicit pin filter is belt and braces.
  const { data: pin } = await client.rpc("current_user_pin");
  if (!pin) return fail(403, "Join a household first.");

  // One round of reads. The household's timezone arrives in the same round,
  // so the date window is a day wider on each side than any zone needs; the
  // snapshot keeps exactly today and the days after it.
  const now = new Date();
  const { dateKey: roughToday } = getLocalDateTime(now, getAppTimezone());
  const firstDay = addDays(roughToday, -1);
  const lastDay = addDays(roughToday, SNAPSHOT_DAYS_AHEAD + 1);

  const [settings, members, people, lists, events, shifts, items] = await Promise.all([
    client.from("household_settings").select("timezone").eq("pin_code", pin).maybeSingle(),
    client.rpc("household_members"),
    client.from("household_people").select("id, user_id, name").eq("pin_code", pin),
    client.from("lists").select("id, name").eq("pin_code", pin).order("created_at"),
    client
      .from("calendar_events")
      .select("*")
      .eq("pin_code", pin)
      .lte("event_date", lastDay)
      // Repeating events can start any time in the past; one-off ones only matter if recent.
      .or(`recurrence.neq.none,event_date.gte.${addDays(firstDay, -EVENT_LOOKBACK_DAYS)}`)
      .order("event_date")
      .limit(MAX_ROWS),
    client
      .from("work_shifts")
      .select("*")
      .eq("pin_code", pin)
      // The day before too: an overnight shift from yesterday is still "at work now".
      .gte("shift_date", addDays(firstDay, -1))
      .lte("shift_date", lastDay)
      .order("shift_date")
      .limit(MAX_ROWS),
    client
      .from("items")
      .select("*, lists!inner(pin_code)")
      .eq("lists.pin_code", pin)
      .eq("is_checked", false)
      .order("created_at")
      .limit(MAX_ROWS),
  ]);
  const timeZone = isValidTimeZone(settings.data?.timezone) ? settings.data.timezone : getAppTimezone();
  const listRows = lists.data ?? [];

  if (members.error || people.error || lists.error || events.error || shifts.error || items.error)
    return fail(502, "Couldn't read the household's data. Try again.");

  const memberRows = Array.isArray(members.data) ? members.data : [];
  // "Who's adding?" on a kitchen display, but only if that member is in this household.
  const asker =
    memberRows.find((member) => member.user_id === ask.asker) ??
    memberRows.find((member) => member.user_id === user.id);

  const snapshot = buildSnapshot({
    now,
    timeZone,
    askerId: asker?.user_id ?? null,
    members: memberRows,
    people: people.data ?? [],
    events: events.data ?? [],
    lists: listRows,
    items: items.data ?? [],
    shifts: shifts.data ?? [],
  });
  const system = buildSystemPrompt(snapshot, asker?.display_name ? shortName(asker.display_name) : null);
  const turns: Turn[] = [...ask.history, { role: "user", text: ask.question }];

  const started = Date.now();
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(MODEL_TIMEOUT_MS)]);
    const answer = await askModel(config, system, turns, signal);
    return Response.json({ answer }, { headers: noStore });
  } catch (error) {
    const kind: AssistantFailure = error instanceof AssistantError ? error.kind : "failed";
    // Status and duration only: never the question, the data or the answer.
    console.error(`assistant: ${config.provider} ${kind} after ${Date.now() - started}ms`);
    return fail(FAILURES[kind].status, FAILURES[kind].error);
  }
}
