// Netlify functions run in UTC, but event dates and times are entered in the
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

/**
 * The scheduler checks every minute, but a reminder stays due from its trigger
 * time until this many minutes after, so a missed or failed run (or an event
 * added just after its trigger time) still gets sent. notification_log stops
 * it being sent twice.
 */
export const REMINDER_CATCH_UP_MINUTES = 30;

export function isReminderDue(
  eventTime: string,
  notifyBefore: number,
  nowMinutes: number,
  catchUpMinutes: number = REMINDER_CATCH_UP_MINUTES,
): boolean {
  const [hours, minutes] = eventTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

  const triggerMinutes = hours * 60 + minutes - notifyBefore;
  return nowMinutes >= triggerMinutes && nowMinutes <= triggerMinutes + catchUpMinutes;
}
