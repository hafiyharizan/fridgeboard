import type { CalendarEvent, CalendarEventType, Recurrence, StickyColor } from "@/lib/types";

// ---------------------------------------------------------------------------
// iCalendar text escaping & formatting helpers
// ---------------------------------------------------------------------------

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\;/g, ";")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\");
}

/** Fold long iCal lines at 75 octets per RFC 5545 §3.1. */
function foldLine(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, MAX));
  let i = MAX;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + MAX - 1));
    i += MAX - 1;
  }
  return chunks.join("\r\n");
}

/** UTC timestamp: 20260407T100000Z */
function toUtcTimestamp(input: string): string {
  return new Date(input).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Date stamp: 20260407 */
function toDateStamp(dateKey: string): string {
  return dateKey.replace(/-/g, "");
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** DTSTART for all-day events uses VALUE=DATE; for timed events use UTC. */
function dtStart(event: CalendarEvent): string {
  if (!event.event_time) {
    return `DTSTART;VALUE=DATE:${toDateStamp(event.event_date)}`;
  }
  const [h, m] = event.event_time.split(":").map((n) => n.padStart(2, "0"));
  return `DTSTART:${toDateStamp(event.event_date)}T${h}${m}00Z`;
}

/** DTEND exclusive — all-day next day; timed defaults to +1 hour. */
function dtEnd(event: CalendarEvent): string {
  if (!event.event_time) {
    return `DTEND;VALUE=DATE:${toDateStamp(addDays(event.event_date, 1))}`;
  }
  const [h, m] = event.event_time.split(":").map(Number);
  const totalMins = h * 60 + m + 60;
  const eh = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
  const em = String(totalMins % 60).padStart(2, "0");
  const dateKey = Math.floor(totalMins / 60) >= 24 ? addDays(event.event_date, 1) : event.event_date;
  return `DTEND:${toDateStamp(dateKey)}T${eh}${em}00Z`;
}

function recurrenceToRRule(recurrence: Recurrence, recurrenceEnd: string | null): string | null {
  const freqMap: Partial<Record<Recurrence, string>> = {
    daily: "FREQ=DAILY",
    weekly: "FREQ=WEEKLY",
    biweekly: "FREQ=WEEKLY;INTERVAL=2",
    monthly: "FREQ=MONTHLY",
    yearly: "FREQ=YEARLY",
  };
  const rule = freqMap[recurrence];
  if (!rule) return null;
  if (recurrenceEnd) return `${rule};UNTIL=${toDateStamp(recurrenceEnd)}T235959Z`;
  return rule;
}

function buildValarm(minutesBefore: number): string[] {
  if (minutesBefore < 0) return [];
  const trigger = minutesBefore === 0 ? "TRIGGER:PT0S" : `TRIGGER:-PT${minutesBefore}M`;
  return ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", trigger, "END:VALARM"];
}

function getDescription(event: CalendarEvent): string | null {
  const parts = [
    event.note?.trim(),
    event.source_label ? `Imported from ${event.source_label}` : null,
  ].filter((v): v is string => Boolean(v));
  return parts.length > 0 ? escapeIcsText(parts.join("\n\n")) : null;
}

// ---------------------------------------------------------------------------
// Build a single VEVENT block
// ---------------------------------------------------------------------------

export function buildVEVENT(event: CalendarEvent): string[] {
  const description = getDescription(event);
  const rrule = recurrenceToRRule(event.recurrence, event.recurrence_end);
  const status = event.is_done ? "COMPLETED" : "CONFIRMED";
  const categories = [event.event_type, event.source_label]
    .filter((v): v is string => Boolean(v))
    .map(escapeIcsText)
    .join(",");

  const updatedAt = (event as CalendarEvent & { updated_at?: string }).updated_at ?? event.created_at;

  const lines: string[] = [
    "BEGIN:VEVENT",
    foldLine(`UID:${event.id}@fridgeboard.app`),
    `DTSTAMP:${toUtcTimestamp(event.created_at)}`,
    `LAST-MODIFIED:${toUtcTimestamp(updatedAt)}`,
    foldLine(`SUMMARY:${escapeIcsText(event.title)}`),
    dtStart(event),
    dtEnd(event),
    `STATUS:${status}`,
  ];

  if (description) lines.push(foldLine(`DESCRIPTION:${description}`));
  if (categories) lines.push(foldLine(`CATEGORIES:${categories}`));
  if (rrule) lines.push(`RRULE:${rrule}`);

  // VALARM only for timed events with an active reminder
  if (event.event_time && event.notify_before >= 0) {
    lines.push(...buildValarm(event.notify_before));
  }

  lines.push("END:VEVENT");
  return lines;
}

// ---------------------------------------------------------------------------
// Build a complete VCALENDAR feed
// ---------------------------------------------------------------------------

export function buildCalendarFeed(
  events: CalendarEvent[],
  {
    calendarName = "Fridgeboard",
    calendarDescription = "Shared household calendar from Fridgeboard",
    calendarUrl,
  }: {
    calendarName?: string;
    calendarDescription?: string;
    calendarUrl?: string;
  } = {},
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fridgeboard//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`),
    foldLine(`X-WR-CALDESC:${escapeIcsText(calendarDescription)}`),
    "X-WR-TIMEZONE:UTC",
  ];

  for (const event of events) {
    const vevent = buildVEVENT(event);
    if (calendarUrl) {
      // Insert URL before END:VEVENT
      vevent.splice(vevent.length - 1, 0, foldLine(`URL:${escapeIcsText(calendarUrl)}`));
    }
    lines.push(...vevent);
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// iCal VEvent parser — used by CalDAV PUT + Google Calendar inbound sync
// ---------------------------------------------------------------------------

/** Unfold continuation lines then extract first property value matching propName. */
function extractProp(ics: string, propName: string): string | null {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  // Match "PROPNAME" or "PROPNAME;params" at line start
  const regex = new RegExp(`(?:^|\\n)${propName}(?:;[^:\\n]*)?:([^\\n]*)`, "i");
  const match = regex.exec(unfolded);
  return match ? match[1]!.trim() : null;
}

/** Parse a DATE or DATETIME iCal value to { dateKey, timeHHMM }. */
function parseDt(raw: string | null): { dateKey: string; timeHHMM: string | null } | null {
  if (!raw) return null;

  // Pure date: 20260407
  if (/^\d{8}$/.test(raw)) {
    return {
      dateKey: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      timeHHMM: null,
    };
  }

  // DateTime: 20260407T100000Z or 20260407T100000
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(raw);
  if (m) {
    return {
      dateKey: `${m[1]}-${m[2]}-${m[3]}`,
      timeHHMM: `${m[4]}:${m[5]}`,
    };
  }

  return null;
}

function rruleToRecurrence(rrule: string | null): {
  recurrence: Recurrence;
  recurrenceEnd: string | null;
} {
  if (!rrule) return { recurrence: "none", recurrenceEnd: null };

  const freqMatch = /FREQ=(\w+)/i.exec(rrule);
  const intervalMatch = /INTERVAL=(\d+)/i.exec(rrule);
  const untilMatch = /UNTIL=(\d{8})/i.exec(rrule);

  const freq = freqMatch?.[1]?.toUpperCase() ?? "";
  const interval = intervalMatch ? parseInt(intervalMatch[1]!, 10) : 1;

  let recurrence: Recurrence = "none";
  if (freq === "DAILY") recurrence = "daily";
  else if (freq === "WEEKLY" && interval === 2) recurrence = "biweekly";
  else if (freq === "WEEKLY") recurrence = "weekly";
  else if (freq === "MONTHLY") recurrence = "monthly";
  else if (freq === "YEARLY") recurrence = "yearly";

  let recurrenceEnd: string | null = null;
  if (untilMatch) {
    const u = untilMatch[1]!;
    recurrenceEnd = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  }

  return { recurrence, recurrenceEnd };
}

export type ParsedVEvent = {
  uid: string | null;
  title: string;
  note: string | null;
  event_date: string;
  event_time: string | null;
  event_type: CalendarEventType;
  color: StickyColor;
  recurrence: Recurrence;
  recurrence_end: string | null;
  notify_before: number;
  is_done: boolean;
};

/**
 * Parse a VCALENDAR or bare VEVENT string.
 * Returns null if no usable VEVENT is found.
 */
export function parseVEVENT(ics: string): ParsedVEvent | null {
  const veventMatch = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/i.exec(ics);
  if (!veventMatch) return null;
  const block = veventMatch[1]!;

  const uid = extractProp(block, "UID");
  const summaryRaw = extractProp(block, "SUMMARY");
  if (!summaryRaw) return null;

  const title = unescapeIcsText(summaryRaw);
  const noteRaw = extractProp(block, "DESCRIPTION");
  const note = noteRaw ? unescapeIcsText(noteRaw).replace(/\\n<!--[\s\S]*?-->/g, "").trim() || null : null;

  const dtStartRaw = extractProp(block, "DTSTART");
  const dt = parseDt(dtStartRaw);
  if (!dt) return null;

  const { recurrence, recurrenceEnd } = rruleToRecurrence(extractProp(block, "RRULE"));

  // Detect notify_before from the first VALARM TRIGGER in the block
  let notifyBefore = -1;
  const triggerRaw = extractProp(block, "TRIGGER");
  if (triggerRaw) {
    const negMins = /^-PT(\d+)M$/i.exec(triggerRaw);
    const zeroSecs = /^PT0S$/i.exec(triggerRaw);
    if (negMins) notifyBefore = parseInt(negMins[1]!, 10);
    else if (zeroSecs) notifyBefore = 0;
  }

  const statusRaw = (extractProp(block, "STATUS") ?? "").toUpperCase();
  const is_done = statusRaw === "COMPLETED" || statusRaw === "CANCELLED";

  const categories = (extractProp(block, "CATEGORIES") ?? "").toLowerCase();
  let event_type: CalendarEventType = "event";
  if (categories.includes("todo")) event_type = "todo";
  else if (categories.includes("reminder")) event_type = "reminder";

  return {
    uid,
    title,
    note,
    event_date: dt.dateKey,
    event_time: dt.timeHHMM,
    event_type,
    color: "blue",
    recurrence,
    recurrence_end: recurrenceEnd,
    notify_before: notifyBefore,
    is_done,
  };
}

// ---------------------------------------------------------------------------
// Google Calendar ↔ Fridgeboard conversion helpers
// ---------------------------------------------------------------------------

export type GoogleEvent = {
  id?: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  recurrence?: string[];
  status?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
  source?: { title: string; url: string };
  updated?: string;
  created?: string;
};

/** Convert a Fridgeboard CalendarEvent to a Google Calendar event body. */
export function toGoogleEvent(event: CalendarEvent, appUrl: string): GoogleEvent {
  const isAllDay = !event.event_time;
  const start = isAllDay
    ? { date: event.event_date }
    : { dateTime: `${event.event_date}T${event.event_time}:00Z`, timeZone: "UTC" };
  const end = isAllDay
    ? { date: addDays(event.event_date, 1) }
    : (() => {
        const [h, m] = event.event_time!.split(":").map(Number);
        const totalMins = h * 60 + m + 60;
        const eh = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
        const em = String(totalMins % 60).padStart(2, "0");
        const dateKey = Math.floor(totalMins / 60) >= 24 ? addDays(event.event_date, 1) : event.event_date;
        return { dateTime: `${dateKey}T${eh}:${em}:00Z`, timeZone: "UTC" };
      })();

  const recurrenceRules: string[] = [];
  const rrule = recurrenceToRRule(event.recurrence, event.recurrence_end);
  if (rrule) recurrenceRules.push(`RRULE:${rrule}`);

  const reminders: GoogleEvent["reminders"] =
    event.event_time && event.notify_before >= 0
      ? { useDefault: false, overrides: [{ method: "popup", minutes: event.notify_before }] }
      : { useDefault: false, overrides: [] };

  // Embed the fridgeboard ID so we can identify it on inbound sync
  const description = [
    event.note?.trim(),
    `<!-- fridgeboard:${event.id} -->`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summary: event.title,
    description,
    start,
    end,
    ...(recurrenceRules.length > 0 ? { recurrence: recurrenceRules } : {}),
    status: event.is_done ? "cancelled" : "confirmed",
    reminders,
    source: { title: "Fridgeboard", url: appUrl },
  };
}

/** Convert a Google Calendar event to a Fridgeboard event shape. */
export function fromGoogleEvent(
  gEvent: GoogleEvent,
): Omit<ParsedVEvent, "uid"> & { googleEventId: string } {
  const googleEventId = gEvent.id ?? "";

  let event_date: string;
  let event_time: string | null = null;

  if (gEvent.start.date) {
    event_date = gEvent.start.date;
  } else if (gEvent.start.dateTime) {
    // dateTime is ISO-8601 e.g. "2026-04-07T10:00:00Z" or with offset
    event_date = gEvent.start.dateTime.slice(0, 10);
    const timeMatch = /T(\d{2}):(\d{2})/.exec(gEvent.start.dateTime);
    if (timeMatch) event_time = `${timeMatch[1]}:${timeMatch[2]}`;
  } else {
    event_date = new Date().toISOString().slice(0, 10);
  }

  const rruleStr = gEvent.recurrence?.find((r) => r.startsWith("RRULE:"))?.slice(6) ?? null;
  const { recurrence, recurrenceEnd } = rruleToRecurrence(rruleStr);

  let notifyBefore = -1;
  if (!gEvent.reminders?.useDefault && gEvent.reminders?.overrides?.length) {
    const popup = gEvent.reminders.overrides.find((o) => o.method === "popup" || o.method === "email");
    if (popup) notifyBefore = popup.minutes;
  }

  // Strip the embedded fridgeboard marker from the description
  const rawNote = gEvent.description ?? "";
  const note = rawNote.replace(/<!--\s*fridgeboard:[^>]+-->/g, "").trim() || null;

  return {
    googleEventId,
    title: gEvent.summary ?? "(no title)",
    note,
    event_date,
    event_time,
    event_type: "event",
    color: "blue",
    recurrence,
    recurrence_end: recurrenceEnd,
    notify_before: notifyBefore,
    is_done: gEvent.status === "cancelled",
  };
}
