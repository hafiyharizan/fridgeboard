// Pure planning for the notification queue: given the data and the time,
// which alerts are due right now? The cron tick inserts the result into
// notification_jobs; job_key makes repeated planning harmless.
//
// Everything is worked out in each household's own timezone, because the
// server runs in UTC and event times are typed as household wall-clock times.

import { addDaysToKey, expandRecurrences } from "@/lib/calendar";
import { getAppTimezone, getLocalDateTime } from "@/lib/local-time";
import { ATHAN_WINDOW_MS, dayInZone, dayKey, prayerSchedule } from "@/lib/prayer";
import type { CalendarEvent, HouseholdSettings, NotificationJobKind } from "@/lib/types";

const MINUTE = 60_000;

/** A reminder stays sendable this long after it comes due (missed or failed runs). */
export const EVENT_REMINDER_WINDOW_MINUTES = 30;
/** The morning summary and grocery reminder are still worth sending this long after. */
export const DAILY_PUSH_WINDOW_MINUTES = 120;
export const DAILY_PUSH_TIMES: Record<"summary" | "grocery", string> = {
  summary: "07:00",
  grocery: "08:00",
};

/** After this many tries a job is marked failed. */
export const MAX_ATTEMPTS = 5;

export type PlannedJob = {
  job_key: string;
  kind: NotificationJobKind;
  pin_code: string;
  due_at: string;
  expires_at: string;
  payload: Record<string, string>;
};

/** The zone a household's alerts use; an unknown zone name falls back to the app default. */
export function householdZone(timeZone: string | null | undefined): string {
  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone });
      return timeZone;
    } catch {
      // fall through
    }
  }
  return getAppTimezone();
}

/** The UTC instant of a wall-clock date and time (HH:MM) in an IANA zone. */
export function zonedTimeToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = hhmm.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  // Guess, measure the zone's offset at the guess, correct; twice settles DST edges.
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    const local = getLocalDateTime(new Date(guess), timeZone);
    const [y, m, d] = local.dateKey.split("-").map(Number);
    const seenWall = Date.UTC(y, m - 1, d, 0, local.minutes);
    guess = wall - (seenWall - Math.floor(guess / MINUTE) * MINUTE);
  }
  return new Date(guess);
}

function isDue(dueAt: number, expiresAt: number, now: number) {
  return now >= dueAt && now < expiresAt;
}

/**
 * Event reminders due now. Looks at yesterday, today and tomorrow (household
 * time), so a reminder before a just-after-midnight event, or a late-night
 * one caught up after midnight, still comes due. Recurring events remind on
 * every occurrence; multi-day events only on their first day.
 */
export function planEventJobs(
  events: CalendarEvent[],
  zoneFor: (pin: string) => string,
  now: Date,
): PlannedJob[] {
  const jobs: PlannedJob[] = [];
  const t = now.getTime();

  for (const event of events) {
    if (event.notify_before < 0 || !event.event_time) continue;
    if (event.is_done && event.recurrence === "none") continue;
    const time = event.event_time.slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(time)) continue;

    const zone = zoneFor(event.pin_code);
    const today = getLocalDateTime(now, zone).dateKey;
    const occurrences = expandRecurrences([event], addDaysToKey(today, -1), addDaysToKey(today, 1));

    for (const occurrence of occurrences) {
      if (occurrence.day_index !== 1) continue;
      const start = zonedTimeToUtc(occurrence.occurrence_date, time, zone).getTime();
      const dueAt = start - event.notify_before * MINUTE;
      const expiresAt = dueAt + EVENT_REMINDER_WINDOW_MINUTES * MINUTE;
      if (!isDue(dueAt, expiresAt, t)) continue;
      jobs.push({
        // Time and lead are in the key: editing either queues a fresh reminder.
        job_key: `event:${event.id}:${occurrence.occurrence_date}:${time}:${event.notify_before}`,
        kind: "event",
        pin_code: event.pin_code,
        due_at: new Date(dueAt).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        payload: {
          event_id: event.id,
          occurrence_date: occurrence.occurrence_date,
          event_time: time,
          notify_before: String(event.notify_before),
        },
      });
    }
  }
  return jobs;
}

/** Athan alerts due now, for households with prayer times and athan alerts on. */
export function planAthanJobs(households: HouseholdSettings[], now: Date): PlannedJob[] {
  const jobs: PlannedJob[] = [];
  const t = now.getTime();

  for (const home of households) {
    if (!home.prayer_enabled || !home.athan_enabled) continue;
    if (home.latitude === null || home.longitude === null) continue;
    const zone = householdZone(home.timezone);
    const today = dayInZone(now, zone);
    // Yesterday too: Isha can fall just before midnight in high latitudes.
    const yesterday = dayInZone(new Date(t - 24 * 60 * MINUTE), zone);

    for (const day of [yesterday, today]) {
      const key = dayKey(day);
      const slots = prayerSchedule(home.latitude, home.longitude, day, home.prayer_method, home.prayer_madhab);
      for (const slot of slots) {
        const dueAt = slot.time.getTime();
        const expiresAt = dueAt + ATHAN_WINDOW_MS;
        if (!isDue(dueAt, expiresAt, t)) continue;
        jobs.push({
          job_key: `athan:${home.pin_code}:${key}:${slot.name}`,
          kind: "athan",
          pin_code: home.pin_code,
          due_at: new Date(dueAt).toISOString(),
          expires_at: new Date(expiresAt).toISOString(),
          payload: {
            prayer: slot.name,
            label: slot.label,
            date: key,
            time: slot.time.toLocaleTimeString("en-AU", { timeZone: zone, hour: "numeric", minute: "2-digit" }),
            place: home.location_name?.split(",")[0] ?? "",
          },
        });
      }
    }
  }
  return jobs;
}

/** Morning summary (07:00) and grocery reminder (08:00), in each household's own time. */
export function planDailyJobs(pins: string[], zoneFor: (pin: string) => string, now: Date): PlannedJob[] {
  const jobs: PlannedJob[] = [];
  const t = now.getTime();

  for (const pin of pins) {
    const zone = zoneFor(pin);
    const today = getLocalDateTime(now, zone).dateKey;
    for (const kind of ["summary", "grocery"] as const) {
      const dueAt = zonedTimeToUtc(today, DAILY_PUSH_TIMES[kind], zone).getTime();
      const expiresAt = dueAt + DAILY_PUSH_WINDOW_MINUTES * MINUTE;
      if (!isDue(dueAt, expiresAt, t)) continue;
      jobs.push({
        job_key: `${kind}:${pin}:${today}`,
        kind,
        pin_code: pin,
        due_at: new Date(dueAt).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        payload: { date: today },
      });
    }
  }
  return jobs;
}

/** When to try a failed job again: 1, 2, 3… minutes after each attempt. */
export function nextTryAt(attempts: number, now: Date): Date {
  return new Date(now.getTime() + Math.min(Math.max(attempts, 1), 5) * MINUTE);
}

/** Events that start on `dateKey` (recurrences included), for the morning summary. */
export function eventsStartingOn(events: CalendarEvent[], dateKey: string) {
  return expandRecurrences(events, dateKey, dateKey).filter(
    (event) => event.day_index === 1 && !(event.is_done && event.recurrence === "none"),
  );
}
