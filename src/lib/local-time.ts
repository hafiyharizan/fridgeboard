// Server code runs in UTC, but event dates and times are entered in the
// household's local time. Cron and assistant code use this to compare like with like.
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
