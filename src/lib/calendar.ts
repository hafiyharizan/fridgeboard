// ---------------------------------------------------------------------------
// Calendar utilities — pure functions, no dependencies
// ---------------------------------------------------------------------------

import type { CalendarEvent, ExpandedCalendarEvent, Recurrence } from "@/lib/types";

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

export function getMonthName(month: number): string {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][month]!;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Recurrence labels
// ---------------------------------------------------------------------------
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "No repeat",
  daily: "Every day",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

export const EVENT_TYPE_ICONS: Record<string, string> = {
  event: "◆",
  reminder: "◎",
  todo: "☐",
};

/** Format an HH:MM (24-hour) string to a localised 12-hour time, e.g. "3:00 PM". */
export function formatEventTime(hhmm: string): string {
  return new Date(`1970-01-01T${hhmm}`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export const NOTIFY_BEFORE_OPTIONS: { value: number; label: string }[] = [
  { value: -1, label: "No reminder" },
  { value: 0, label: "At event time" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
];

// ---------------------------------------------------------------------------
// Recurrence expansion — generate virtual occurrences for a date range
// ---------------------------------------------------------------------------

function addInterval(date: Date, recurrence: Recurrence): Date {
  const next = new Date(date);
  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "biweekly":
      next.setDate(next.getDate() + 14);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  return next;
}

function toDateKey(d: Date): string {
  return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Expand all recurring events into virtual occurrences within [rangeStart, rangeEnd].
 * Non-recurring events pass through as-is.
 */
export function expandRecurrences(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
): ExpandedCalendarEvent[] {
  const result: ExpandedCalendarEvent[] = [];

  for (const event of events) {
    // Non-recurring: just wrap it
    if (event.recurrence === "none") {
      if (event.event_date >= rangeStart && event.event_date <= rangeEnd) {
        result.push({ ...event, occurrence_date: event.event_date, is_recurrence: false });
      }
      continue;
    }

    // Recurring: walk from event_date forward generating occurrences
    const endBound = event.recurrence_end
      ? (event.recurrence_end < rangeEnd ? event.recurrence_end : rangeEnd)
      : rangeEnd;

    let current = new Date(event.event_date + "T00:00:00");
    const rangeStartDate = new Date(rangeStart + "T00:00:00");
    const endBoundDate = new Date(endBound + "T00:00:00");

    // Fast-forward to range start if possible
    while (current < rangeStartDate) {
      current = addInterval(current, event.recurrence);
    }

    let safety = 0;
    while (current <= endBoundDate && safety < 366) {
      const dateKey = toDateKey(current);
      const isOriginal = dateKey === event.event_date;
      result.push({
        ...event,
        occurrence_date: dateKey,
        is_recurrence: !isOriginal,
      });
      current = addInterval(current, event.recurrence);
      safety++;
    }
  }

  return result.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/**
 * Get the date range for a given month view.
 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  return {
    start: formatDateKey(year, month, 1),
    end: formatDateKey(year, month, getDaysInMonth(year, month)),
  };
}
