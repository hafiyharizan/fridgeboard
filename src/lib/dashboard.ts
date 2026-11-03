import { expandRecurrences, formatDateKey } from "@/lib/calendar";
import type { CalendarEvent, Item } from "@/lib/types";

export function dateKey(date: Date) {
  return formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function weekDates(today: string) {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return dateKey(date);
  });
}

export function upcomingEvents(
  events: CalendarEvent[],
  start: string,
  end: string,
) {
  return expandRecurrences(events, start, end)
    .filter((event) => !event.is_done)
    .sort(
      (a, b) =>
        a.occurrence_date.localeCompare(b.occurrence_date) ||
        (a.event_time ?? "").localeCompare(b.event_time ?? "") ||
        a.title.localeCompare(b.title),
    );
}

export function pendingItems(items: Item[]) {
  return items.filter((item) => !item.is_checked);
}
