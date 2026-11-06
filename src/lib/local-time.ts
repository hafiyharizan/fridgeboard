// Server code runs in UTC, but event dates and times are entered in the
// household's local time. Cron routes use this to compare like with like.
export const DEFAULT_APP_TIMEZONE = "Australia/Perth";

export function getAppTimezone(): string {
  return process.env.APP_TIMEZONE || DEFAULT_APP_TIMEZONE;
}

/** Local calendar date (YYYY-MM-DD) and minutes since local midnight. */
export function getLocalDateTime(now: Date, timeZone: string = getAppTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** `timeZone` if the runtime knows it, else the app default. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return getAppTimezone();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return getAppTimezone();
  }
}

/** How far `timeZone` is ahead of UTC at `at`, in ms. */
function zoneOffsetMs(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return wall - Math.floor(at / 60_000) * 60_000;
}

/**
 * The moment a local date (YYYY-MM-DD) and time (HH:MM) happen in `timeZone`.
 * Null when either is malformed.
 */
export function zonedTime(dateKey: string, time: string, timeZone: string): Date | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const clock = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!date || !clock) return null;
  const hours = Number(clock[1]);
  const minutes = Number(clock[2]);
  if (hours > 23 || minutes > 59) return null;

  const wall = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]), hours, minutes);
  if (!Number.isFinite(wall)) return null;
  // Guess with the offset at the wall time, then correct once for a DST change in between.
  let at = wall - zoneOffsetMs(wall, timeZone);
  const corrected = wall - zoneOffsetMs(at, timeZone);
  if (corrected !== at) at = corrected;
  return new Date(at);
}

/**
 * The scheduler checks every minute, but a reminder stays due from its trigger
 * time until this many minutes after, so a missed or failed run (or an event
 * added just after its trigger time) still gets sent. notification_log stops
 * it being sent twice. The database check (cron_tick_due) uses the same window.
 */
export const REMINDER_CATCH_UP_MINUTES = 30;

/** When an event's reminder fires: its local start time minus notify_before minutes. */
export function reminderTriggerAt(
  event: { event_date: string; event_time: string | null; notify_before: number },
  timeZone: string,
): Date | null {
  if (!event.event_time || event.notify_before < 0) return null;
  const start = zonedTime(event.event_date, event.event_time, timeZone);
  return start ? new Date(start.getTime() - event.notify_before * 60_000) : null;
}

export function isReminderDue(
  triggerAt: Date | null,
  now: Date,
  catchUpMinutes: number = REMINDER_CATCH_UP_MINUTES,
): boolean {
  if (!triggerAt) return false;
  const t = now.getTime();
  return t >= triggerAt.getTime() && t <= triggerAt.getTime() + catchUpMinutes * 60_000;
}
