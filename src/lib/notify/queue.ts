// The notification queue, run once a minute by /api/cron/tick:
//   1. planDueJobs: add a notification_jobs row for every alert due now
//      (job_key makes this idempotent, so overlapping runs can't double up).
//   2. deliverDueJobs: claim due rows and send them. Each channel that gets
//      the alert is recorded in done_targets, so a retry only resends what
//      failed, never what already arrived.

import "server-only";
import { addDaysToKey, formatEventTime } from "@/lib/calendar";
import { sendPush, type PushPayload } from "@/lib/push";
import type { createSupabaseServiceClient } from "@/lib/supabase-admin";
import type { CalendarEvent, Database, HouseholdSettings, NotificationJob, NotifyChannel } from "@/lib/types";
import { sendEmail, sendTelegram, sendWebhook, type SendFailure } from "./channels";
import {
  MAX_ATTEMPTS,
  eventsStartingOn,
  householdZone,
  nextTryAt,
  planAthanJobs,
  planDailyJobs,
  planEventJobs,
  type PlannedJob,
} from "./plan";

type Db = ReturnType<typeof createSupabaseServiceClient>;

const CLAIM_BATCH = 50;
const CLAIM_LEASE_SECONDS = 120;

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

const EVENT_COLUMNS =
  "id, pin_code, event_date, event_time, end_date, title, note, event_type, color, is_done, recurrence, recurrence_end, notify_before, notify_channels, created_at, source_type, source_label, source_event_id";

/** Events that start (or recur) between two date keys, inclusive. */
function eventsBetween(db: Db, from: string, to: string) {
  return db
    .from("calendar_events")
    .select(EVENT_COLUMNS)
    .or(
      `and(recurrence.eq.none,event_date.gte.${from},event_date.lte.${to}),` +
        `and(recurrence.neq.none,event_date.lte.${to},or(recurrence_end.is.null,recurrence_end.gte.${from}))`,
    );
}

export async function planDueJobs(db: Db, now: Date): Promise<{ planned: number; queued: number; errors: string[] }> {
  const errors: string[] = [];
  // Wide enough to cover every timezone's yesterday..tomorrow.
  const utcToday = now.toISOString().slice(0, 10);

  const [settingsRes, eventsRes, subsRes] = await Promise.all([
    db.from("household_settings").select("*"),
    eventsBetween(db, addDaysToKey(utcToday, -2), addDaysToKey(utcToday, 2))
      .gte("notify_before", 0)
      .not("event_time", "is", null),
    db.from("push_subscriptions").select("pin_code"),
  ]);
  if (settingsRes.error) errors.push(`settings: ${settingsRes.error.message}`);
  if (eventsRes.error) errors.push(`events: ${eventsRes.error.message}`);
  if (subsRes.error) errors.push(`subscriptions: ${subsRes.error.message}`);

  const settings: HouseholdSettings[] = settingsRes.data ?? [];
  const zones = new Map(settings.map((home) => [home.pin_code, householdZone(home.timezone)]));
  const zoneFor = (pin: string) => zones.get(pin) ?? householdZone(null);
  const pins = [...new Set((subsRes.data ?? []).map((row) => row.pin_code))];

  const jobs: PlannedJob[] = [
    ...planEventJobs((eventsRes.data ?? []) as CalendarEvent[], zoneFor, now),
    ...planAthanJobs(settings, now),
    ...planDailyJobs(pins, zoneFor, now),
  ];
  if (!jobs.length) return { planned: 0, queued: 0, errors };

  const { data, error } = await db
    .from("notification_jobs")
    .upsert(jobs, { onConflict: "job_key", ignoreDuplicates: true })
    .select("id");
  if (error) errors.push(`queue: ${error.message}`);
  return { planned: jobs.length, queued: data?.length ?? 0, errors };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/** null = delivered, "none" = nobody to deliver to, otherwise why it failed. */
type TargetResult = SendFailure | null | "none";
type Target = { key: string; send: () => Promise<TargetResult> };
type Plan = { skip: string } | { targets: Target[] };

function secondsLeft(job: NotificationJob, now: Date) {
  return Math.max(60, Math.floor((new Date(job.expires_at).getTime() - now.getTime()) / 1000));
}

function pushTarget(
  db: Db,
  job: NotificationJob,
  payload: PushPayload,
  now: Date,
  urgency: "normal" | "high",
): Target {
  return {
    key: "push",
    send: async () => {
      const result = await sendPush(job.pin_code, payload, db, { ttlSeconds: secondsLeft(job, now), urgency });
      if (!result.configured) return { reason: "VAPID keys not set", retry: false };
      if (result.sent > 0) return null;
      if (result.failed > 0) return { reason: `push failed on ${result.failed} device(s)`, retry: true };
      return "none";
    },
  };
}

async function planEvent(db: Db, job: NotificationJob, now: Date): Promise<Plan> {
  const { event_id, occurrence_date, event_time, notify_before } = job.payload;
  const { data: event, error } = await db
    .from("calendar_events")
    .select("id, title, note, event_type, event_date, event_time, is_done, recurrence, notify_before, notify_channels")
    .eq("id", event_id)
    .maybeSingle();
  if (error) throw new Error(`event lookup: ${error.message}`);
  if (!event) return { skip: "event deleted" };
  // Edited since it was queued: the new time/lead has its own job.
  if (event.event_time?.slice(0, 5) !== event_time || String(event.notify_before) !== notify_before) {
    return { skip: "event changed" };
  }
  if (event.is_done && event.recurrence === "none") return { skip: "event done" };

  const when = `${occurrence_date} · ${formatEventTime(event_time)}`;
  const targets: Target[] = [
    pushTarget(
      db,
      job,
      {
        title: event.title,
        body: event.note || `Reminder · ${formatEventTime(event_time)}`,
        tag: `calendar-${event.id}-${occurrence_date}`,
        url: "/list",
      },
      now,
      "high",
    ),
  ];

  const channels = (event.notify_channels as NotifyChannel[] | null) ?? [];
  if (channels.length) {
    const { data: configs, error: configError } = await db
      .from("notification_channels")
      .select("id, channel_type, channel_value")
      .eq("pin_code", job.pin_code)
      .eq("is_enabled", true)
      .in("channel_type", channels);
    if (configError) throw new Error(`channels: ${configError.message}`);

    const text = `Fridgeboard reminder\n\n${event.title}${event.note ? `\n${event.note}` : ""}\n\n${when}`;
    for (const config of configs ?? []) {
      const key = `${config.channel_type}:${config.id}`;
      if (config.channel_type === "email") {
        targets.push({ key, send: () => sendEmail(config.channel_value, `Fridgeboard: ${event.title}`, text) });
      } else if (config.channel_type === "telegram") {
        targets.push({ key, send: () => sendTelegram(config.channel_value, text) });
      } else if (config.channel_type === "webhook") {
        targets.push({
          key,
          send: () =>
            sendWebhook(config.channel_value, {
              event_id: event.id,
              title: event.title,
              note: event.note,
              event_date: occurrence_date,
              event_time,
              event_type: event.event_type,
            }),
        });
      }
    }
  }
  return { targets };
}

function planAthan(db: Db, job: NotificationJob, now: Date): Plan {
  const { prayer, label, date, time, place } = job.payload;
  return {
    targets: [
      pushTarget(
        db,
        job,
        {
          title: `Time for ${label}`,
          body: `${label} · ${time}${place ? ` in ${place}` : ""}`,
          tag: `athan-${prayer}-${date}`,
          url: "/list",
        },
        now,
        "high",
      ),
    ],
  };
}

async function openGroceries(db: Db, pin: string): Promise<{ count: number; first: string | null }> {
  const { data: lists, error } = await db.from("lists").select("id, name").eq("pin_code", pin);
  if (error) throw new Error(`lists: ${error.message}`);
  const ids = (lists ?? []).filter((list) => list.name.toLowerCase().startsWith("groc")).map((list) => list.id);
  if (!ids.length) return { count: 0, first: null };

  const { data: items, count, error: itemsError } = await db
    .from("items")
    .select("text", { count: "exact" })
    .in("list_id", ids)
    .eq("is_checked", false)
    .limit(1);
  if (itemsError) throw new Error(`items: ${itemsError.message}`);
  return { count: count ?? 0, first: items?.[0]?.text ?? null };
}

async function planDaily(db: Db, job: NotificationJob, now: Date): Promise<Plan> {
  const date = job.payload.date;
  const groceries = await openGroceries(db, job.pin_code);

  if (job.kind === "grocery") {
    if (!groceries.count) return { skip: "grocery list empty" };
    const body =
      groceries.count === 1 && groceries.first
        ? `${groceries.first} is still on the grocery list`
        : `${groceries.count} items still on the grocery list`;
    return {
      targets: [pushTarget(db, job, { title: "Grocery reminder", body, tag: `grocery-${date}`, url: "/list" }, now, "normal")],
    };
  }

  const { data: events, error } = await eventsBetween(db, date, date).eq("pin_code", job.pin_code);
  if (error) throw new Error(`events: ${error.message}`);
  const today = eventsStartingOn((events ?? []) as CalendarEvent[], date);

  const parts: string[] = [];
  if (today.length) parts.push(`${today.length} event${today.length > 1 ? "s" : ""} today`);
  if (groceries.count) parts.push(`${groceries.count} grocery item${groceries.count > 1 ? "s" : ""} to grab`);
  if (!parts.length) return { skip: "nothing to report" };

  return {
    targets: [
      pushTarget(
        db,
        job,
        { title: "Good morning — Fridgeboard", body: parts.join(" · "), tag: `summary-${date}`, url: "/list" },
        now,
        "normal",
      ),
    ],
  };
}

export type JobOutcome = "sent" | "skipped" | "retrying" | "failed";

/** Sends one claimed job and records the result. Never throws. */
export async function deliverJob(db: Db, job: NotificationJob, now: Date): Promise<JobOutcome> {
  const done = new Set(job.done_targets);
  const problems: string[] = [];
  let retry = false;
  let delivered = 0;

  try {
    const plan =
      job.kind === "event"
        ? await planEvent(db, job, now)
        : job.kind === "athan"
          ? planAthan(db, job, now)
          : await planDaily(db, job, now);

    if ("skip" in plan) {
      await finish(db, job, { status: "skipped", last_error: plan.skip });
      return "skipped";
    }

    for (const target of plan.targets) {
      if (done.has(target.key)) {
        delivered += 1;
        continue;
      }
      const result = await target.send();
      if (result === null) {
        done.add(target.key);
        delivered += 1;
      } else if (result === "none") {
        done.add(target.key);
      } else {
        problems.push(result.reason);
        if (result.retry) retry = true;
        else done.add(target.key); // won't fix itself; don't try it again
      }
    }
  } catch (error) {
    problems.push(error instanceof Error ? error.message : "unexpected error");
    retry = true;
  }

  const doneTargets = [...done];
  const lastError = problems.length ? problems.join("; ").slice(0, 500) : null;

  if (retry && job.attempts < MAX_ATTEMPTS) {
    await finish(db, job, {
      status: "pending",
      next_try_at: nextTryAt(job.attempts, now).toISOString(),
      done_targets: doneTargets,
      last_error: lastError,
    });
    return "retrying";
  }

  const status = delivered > 0 ? "sent" : problems.length ? "failed" : "skipped";
  await finish(db, job, {
    status,
    done_targets: doneTargets,
    last_error: status === "skipped" && !lastError ? "nobody to notify" : lastError,
    sent_at: status === "sent" ? now.toISOString() : null,
  });
  return status;
}

async function finish(
  db: Db,
  job: NotificationJob,
  update: Database["public"]["Tables"]["notification_jobs"]["Update"],
) {
  const { error } = await db
    .from("notification_jobs")
    .update({ ...update, locked_until: null })
    .eq("id", job.id);
  if (error) console.error(`[notify] could not record job ${job.kind}:`, error.message);
}

export async function deliverDueJobs(db: Db, now: Date) {
  const counts: Record<JobOutcome, number> = { sent: 0, skipped: 0, retrying: 0, failed: 0 };
  const { data: jobs, error } = await db.rpc("claim_notification_jobs", {
    batch: CLAIM_BATCH,
    lease_seconds: CLAIM_LEASE_SECONDS,
  });
  if (error) return { claimed: 0, ...counts, error: `claim: ${error.message}` };

  const outcomes = await Promise.all((jobs ?? []).map((job) => deliverJob(db, job, now)));
  for (const outcome of outcomes) counts[outcome] += 1;
  return { claimed: jobs?.length ?? 0, ...counts };
}
