import type { CalendarEvent, Recurrence } from "@/lib/types";

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toUtcTimestamp(input: string) {
  const value = new Date(input);
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toDateStamp(dateKey: string) {
  return dateKey.replace(/-/g, "");
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function recurrenceToRRule(recurrence: Recurrence, recurrenceEnd: string | null) {
  const frequencyMap: Partial<Record<Recurrence, string>> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    biweekly: "WEEKLY;INTERVAL=2",
    monthly: "MONTHLY",
    yearly: "YEARLY",
  };

  const frequency = frequencyMap[recurrence];
  if (!frequency) {
    return null;
  }

  const rule = [`FREQ=${frequency}`];
  if (frequency.includes(";")) {
    const [freq, extra] = frequency.split(";");
    rule[0] = `FREQ=${freq}`;
    rule.push(extra!);
  }

  if (recurrenceEnd) {
    rule.push(`UNTIL=${toDateStamp(recurrenceEnd)}T235959Z`);
  }

  return rule.join(";");
}

function getDescription(event: CalendarEvent) {
  const lines = [event.note?.trim(), event.source_label ? `Imported from ${event.source_label}` : null]
    .filter((value): value is string => Boolean(value));

  return lines.length > 0 ? escapeIcsText(lines.join("\n\n")) : null;
}

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
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fridgeboard//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    `X-WR-CALDESC:${escapeIcsText(calendarDescription)}`,
  ];

  for (const event of events) {
    const description = getDescription(event);
    const rrule = recurrenceToRRule(event.recurrence, event.recurrence_end);
    const status = event.is_done ? "COMPLETED" : "CONFIRMED";
    const categories = [event.event_type, event.source_label]
      .filter((value): value is string => Boolean(value))
      .map(escapeIcsText)
      .join(",");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@fridgeboard.app`);
    lines.push(`DTSTAMP:${toUtcTimestamp(event.created_at)}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    lines.push(`DTSTART;VALUE=DATE:${toDateStamp(event.event_date)}`);
    lines.push(`DTEND;VALUE=DATE:${toDateStamp(addDays(event.event_date, 1))}`);
    lines.push(`STATUS:${status}`);

    if (description) {
      lines.push(`DESCRIPTION:${description}`);
    }

    if (categories) {
      lines.push(`CATEGORIES:${categories}`);
    }

    if (rrule) {
      lines.push(`RRULE:${rrule}`);
    }

    if (calendarUrl) {
      lines.push(`URL:${escapeIcsText(calendarUrl)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
