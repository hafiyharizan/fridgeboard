/**
 * Google Calendar API helpers — pure functions and fetch wrappers.
 * No Google SDK; uses the REST API directly so this stays Edge-compatible.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, GoogleCalendarToken } from "@/lib/types";
import { toGoogleEvent, fromGoogleEvent } from "@/lib/calendar-feed";
import type { CalendarEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
    scopes: "https://www.googleapis.com/auth/calendar",
  };
}

export function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// OAuth2 state — HMAC-SHA-256 signed to bind it to a pin_code
// ---------------------------------------------------------------------------

async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Create a short-lived, HMAC-signed state token carrying the pin_code. */
export async function createOAuthState(pinCode: string): Promise<string> {
  const secret = process.env.CRON_SECRET ?? "fridgeboard-oauth-state";
  const ts = Date.now();
  const payload = `${pinCode}:${ts}`;
  const sig = await hmacHex(payload, secret);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/** Verify and decode a state token. Returns pin_code or null if invalid/expired. */
export async function verifyOAuthState(state: string): Promise<string | null> {
  const secret = process.env.CRON_SECRET ?? "fridgeboard-oauth-state";
  try {
    const raw = Buffer.from(state, "base64url").toString();
    const lastColon = raw.lastIndexOf(":");
    const prevColon = raw.lastIndexOf(":", lastColon - 1);
    const payload = raw.slice(0, lastColon);
    const sig = raw.slice(lastColon + 1);
    const pinCode = raw.slice(0, prevColon);
    const ts = parseInt(raw.slice(prevColon + 1, lastColon), 10);

    if (Date.now() - ts > STATE_TTL_MS) return null;

    const expected = await hmacHex(payload, secret);
    if (expected !== sig) return null;

    return pinCode;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/** Exchange an auth code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const { clientId, clientSecret, redirectUri } = googleConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    console.error("[Google] Token exchange failed:", await res.text());
    return null;
  }

  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_in: number }>;
}

/** Refresh an expired access token. Returns new access_token + expires_in, or null on failure. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const { clientId, clientSecret } = googleConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[Google] Token refresh failed:", await res.text());
    return null;
  }

  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Retrieve a valid access token for the household, refreshing if needed. */
export async function getValidAccessToken(pinCode: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("pin_code", pinCode)
    .single();

  if (!row) return null;

  const token = row as GoogleCalendarToken;
  const expiresAt = new Date(token.expires_at).getTime();
  // Refresh if expiring in < 5 minutes
  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(token.refresh_token);
    if (!refreshed) return null;

    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_tokens")
      .update({ access_token: refreshed.access_token, expires_at: newExpiresAt })
      .eq("pin_code", pinCode);

    return refreshed.access_token;
  }

  return token.access_token;
}

// ---------------------------------------------------------------------------
// Google Calendar API calls
// ---------------------------------------------------------------------------

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function gcalFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

/** Create a push-notification watch channel for a calendar. */
export async function registerWatch(
  accessToken: string,
  calendarId: string,
  webhookUrl: string,
): Promise<{ channelId: string; resourceId: string; expiration: number } | null> {
  const channelId = crypto.randomUUID();
  const res = await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        // Expire in 7 days (max allowed by Google is 30d for calendar events)
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    },
  );

  if (!res.ok) {
    console.error("[Google] Watch registration failed:", await res.text());
    return null;
  }

  const data = (await res.json()) as { id: string; resourceId: string; expiration: string };
  return {
    channelId: data.id,
    resourceId: data.resourceId,
    expiration: parseInt(data.expiration, 10),
  };
}

/** Stop a push-notification watch channel. */
export async function stopWatch(
  accessToken: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  await gcalFetch("/channels/stop", accessToken, {
    method: "POST",
    body: JSON.stringify({ id: channelId, resourceId }),
  });
}

// ---------------------------------------------------------------------------
// Bidirectional sync
// ---------------------------------------------------------------------------

export type SyncResult = {
  pushed: number;
  pulled: number;
  deleted: number;
  errors: string[];
};

/**
 * Full bidirectional sync between Fridgeboard and Google Calendar.
 *
 * Strategy:
 *   - Fridgeboard → Google: for each Fridgeboard event, create or update the
 *     corresponding Google Calendar event. Store the google_event_id back.
 *   - Google → Fridgeboard: list all Google events. For events that contain
 *     the <!-- fridgeboard:{id} --> marker, update the Fridgeboard row if
 *     the Google version is newer. For events without the marker, insert
 *     them into Fridgeboard with source_type = 'google_calendar'.
 *   - Deletions: cancelled Google events are deleted from Fridgeboard.
 */
export async function syncCalendar(pinCode: string, appUrl: string): Promise<SyncResult> {
  const result: SyncResult = { pushed: 0, pulled: 0, deleted: 0, errors: [] };

  const accessToken = await getValidAccessToken(pinCode);
  if (!accessToken) {
    result.errors.push("Could not obtain a valid access token. Reconnect Google Calendar.");
    return result;
  }

  const supabase = getServiceClient();

  // ── Step 1: Load Fridgeboard events ──────────────────────────────────────
  const { data: fridgeEvents, error: fetchErr } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("pin_code", pinCode);

  if (fetchErr) {
    result.errors.push(`DB read failed: ${fetchErr.message}`);
    return result;
  }

  const events = (fridgeEvents ?? []) as CalendarEvent[];

  // ── Step 2: Fridgeboard → Google ─────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_calendar_tokens")
    .select("google_calendar_id")
    .eq("pin_code", pinCode)
    .single();

  const calendarId = (tokenRow?.google_calendar_id as string | undefined) ?? "primary";

  for (const event of events) {
    const gEvent = toGoogleEvent(event, appUrl);
    try {
      if (event.google_event_id) {
        // Update
        const res = await gcalFetch(
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.google_event_id)}`,
          accessToken,
          { method: "PUT", body: JSON.stringify(gEvent) },
        );
        if (res.ok) {
          result.pushed++;
        } else if (res.status === 404) {
          // Event was deleted from Google — clear the reference
          await supabase
            .from("calendar_events")
            .update({ google_event_id: null })
            .eq("id", event.id);
        } else {
          result.errors.push(`PUT event ${event.id}: ${res.status}`);
        }
      } else {
        // Create
        const res = await gcalFetch(
          `/calendars/${encodeURIComponent(calendarId)}/events`,
          accessToken,
          { method: "POST", body: JSON.stringify(gEvent) },
        );
        if (res.ok) {
          const created = (await res.json()) as { id: string };
          await supabase
            .from("calendar_events")
            .update({ google_event_id: created.id })
            .eq("id", event.id);
          result.pushed++;
        } else {
          result.errors.push(`POST event ${event.id}: ${res.status}`);
        }
      }
    } catch (err) {
      result.errors.push(`Event ${event.id}: ${String(err)}`);
    }
  }

  // ── Step 3: Google → Fridgeboard (incremental) ───────────────────────────
  let pageToken: string | undefined;
  const { data: tokenData } = await supabase
    .from("google_calendar_tokens")
    .select("sync_token")
    .eq("pin_code", pinCode)
    .single();

  const syncToken = (tokenData?.sync_token as string | undefined) ?? undefined;
  let newSyncToken: string | undefined;

  do {
    const params = new URLSearchParams({ maxResults: "250", showDeleted: "true" });
    if (syncToken && !pageToken) params.set("syncToken", syncToken);
    if (!syncToken && !pageToken) params.set("timeMin", "2020-01-01T00:00:00Z");
    if (pageToken) params.set("pageToken", pageToken);

    const res = await gcalFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      accessToken,
    );

    if (!res.ok) {
      if (res.status === 410) {
        // Sync token expired — clear it and do a full resync next time
        await supabase
          .from("google_calendar_tokens")
          .update({ sync_token: null })
          .eq("pin_code", pinCode);
      }
      result.errors.push(`Google events list: ${res.status}`);
      break;
    }

    const page = (await res.json()) as {
      items?: Array<Record<string, unknown>>;
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    pageToken = page.nextPageToken;
    newSyncToken = page.nextSyncToken ?? newSyncToken;

    for (const rawEvent of page.items ?? []) {
      const gEvent = rawEvent as {
        id: string;
        status?: string;
        summary?: string;
        description?: string;
        start?: { date?: string; dateTime?: string };
        end?: { date?: string; dateTime?: string };
        recurrence?: string[];
        reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
        updated?: string;
      };

      if (!gEvent.summary && gEvent.status !== "cancelled") continue;

      // Check if this event was originated by Fridgeboard
      const fridgeIdMatch = /<!--\s*fridgeboard:([a-f0-9-]{36})\s*-->/.exec(
        gEvent.description ?? "",
      );

      if (fridgeIdMatch) {
        const fridgeId = fridgeIdMatch[1]!;

        if (gEvent.status === "cancelled") {
          // Deleted in Google → delete in Fridgeboard (only if it was a Google-originated copy)
          const { data: existing } = await supabase
            .from("calendar_events")
            .select("id, source_type, google_event_id")
            .eq("id", fridgeId)
            .single();

          // Only delete if it came from Google originally (not a Fridgeboard-authored event
          // that was reflected to Google — those should survive)
          if (existing && existing.source_type === "google_calendar") {
            await supabase.from("calendar_events").delete().eq("id", fridgeId);
            result.deleted++;
          } else if (existing) {
            // Clear the google_event_id so it gets re-pushed next sync
            await supabase
              .from("calendar_events")
              .update({ google_event_id: null })
              .eq("id", fridgeId);
          }
          continue;
        }

        // Compare updated timestamps to decide whether to pull Google's version
        const { data: existing } = await supabase
          .from("calendar_events")
          .select("updated_at")
          .eq("id", fridgeId)
          .single();

        if (existing && gEvent.updated) {
          const googleUpdated = new Date(gEvent.updated).getTime();
          const fridgeUpdated = new Date(existing.updated_at as string).getTime();
          if (googleUpdated <= fridgeUpdated) continue; // Fridgeboard is already up-to-date
        }

        // Pull Google's version into Fridgeboard
        const parsed = fromGoogleEvent({
          id: gEvent.id,
          summary: gEvent.summary ?? "",
          description: gEvent.description,
          start: gEvent.start ?? {},
          end: gEvent.end ?? {},
          recurrence: gEvent.recurrence,
          reminders: gEvent.reminders,
          status: gEvent.status,
        });

        await supabase
          .from("calendar_events")
          .update({
            title: parsed.title,
            note: parsed.note,
            event_date: parsed.event_date,
            event_time: parsed.event_time,
            recurrence: parsed.recurrence,
            recurrence_end: parsed.recurrence_end,
            notify_before: parsed.notify_before,
            is_done: parsed.is_done,
          })
          .eq("id", fridgeId);

        result.pulled++;
      } else if (gEvent.status !== "cancelled") {
        // New event from Google with no Fridgeboard marker — import it
        const { data: existingByGid } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("pin_code", pinCode)
          .eq("google_event_id", gEvent.id)
          .single();

        const parsed = fromGoogleEvent({
          id: gEvent.id,
          summary: gEvent.summary ?? "",
          description: gEvent.description,
          start: gEvent.start ?? {},
          end: gEvent.end ?? {},
          recurrence: gEvent.recurrence,
          reminders: gEvent.reminders,
          status: gEvent.status,
        });

        if (existingByGid) {
          await supabase
            .from("calendar_events")
            .update({
              title: parsed.title,
              note: parsed.note,
              event_date: parsed.event_date,
              event_time: parsed.event_time,
              recurrence: parsed.recurrence,
              recurrence_end: parsed.recurrence_end,
              notify_before: parsed.notify_before,
              is_done: parsed.is_done,
            })
            .eq("id", existingByGid.id);
        } else {
          await supabase.from("calendar_events").insert({
            pin_code: pinCode,
            title: parsed.title,
            note: parsed.note,
            event_date: parsed.event_date,
            event_time: parsed.event_time,
            event_type: "event",
            color: "blue",
            recurrence: parsed.recurrence,
            recurrence_end: parsed.recurrence_end,
            notify_before: parsed.notify_before,
            notify_channels: [],
            is_done: parsed.is_done,
            source_type: "google_calendar",
            source_event_id: gEvent.id,
            google_event_id: gEvent.id,
          });
        }

        result.pulled++;
      } else if (gEvent.status === "cancelled") {
        // Cancelled event with no Fridgeboard marker — delete by google_event_id
        const { data: existing } = await supabase
          .from("calendar_events")
          .select("id")
          .eq("pin_code", pinCode)
          .eq("google_event_id", gEvent.id)
          .single();

        if (existing) {
          await supabase.from("calendar_events").delete().eq("id", existing.id);
          result.deleted++;
        }
      }
    }
  } while (pageToken);

  // Save new sync token
  if (newSyncToken) {
    await supabase
      .from("google_calendar_tokens")
      .update({ sync_token: newSyncToken })
      .eq("pin_code", pinCode);
  }

  return result;
}
