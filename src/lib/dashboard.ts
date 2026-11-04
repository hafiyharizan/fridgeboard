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

/** "Good morning" (5–11), "Good afternoon" (12–16), "Good evening" (17–21), "Good night". */
export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

/** The day after a YYYY-MM-DD key. */
export function nextDateKey(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return dateKey(date);
}

type Timed = { occurrence_date: string; event_time?: string | null };

/**
 * The next event still ahead of `now`: later today (or all-day today),
 * otherwise the first one on a later day. Expects events sorted by
 * date then time, as `upcomingEvents` returns them.
 */
export function nextUpEvent<T extends Timed>(events: T[], now: Date): T | null {
  const today = dateKey(now);
  const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    events.find((event) => {
      if (event.occurrence_date > today) return true;
      if (event.occurrence_date < today) return false;
      return !event.event_time || event.event_time.slice(0, 5) >= clock;
    }) ?? null
  );
}

/** An event still counts as happening for this long after it starts. */
export const EVENT_GRACE_MINUTES = 60;

export type EventPhase = "earlier" | "now" | "later";

/**
 * Where an event sits relative to `now`: finished ("earlier"), under way
 * (from its start until EVENT_GRACE_MINUTES later, or all day) or ahead.
 */
export function eventPhase(event: Timed, now: Date, graceMinutes = EVENT_GRACE_MINUTES): EventPhase {
  const today = dateKey(now);
  if (event.occurrence_date < today) return "earlier";
  if (event.occurrence_date > today) return "later";
  if (!event.event_time) return "now";
  const [hours, minutes] = event.event_time.split(":").map(Number);
  const start = hours * 60 + minutes;
  const clock = now.getHours() * 60 + now.getMinutes();
  if (clock < start) return "later";
  return clock < start + graceMinutes ? "now" : "earlier";
}

/**
 * Which day Home's schedule opens on: tomorrow once everything today is
 * over (or, on an empty day, from 6 PM), otherwise today.
 */
export function defaultScheduleDay(events: Timed[], now: Date): "today" | "tomorrow" {
  const today = dateKey(now);
  const todays = events.filter((event) => event.occurrence_date === today);
  if (!todays.length) return now.getHours() >= 18 ? "tomorrow" : "today";
  return todays.every((event) => eventPhase(event, now) === "earlier") ? "tomorrow" : "today";
}

/**
 * How many equal-height rows fit in `available` pixels with `gap` between
 * them. Used to show whole rows instead of cutting the last one off.
 */
export function rowsThatFit(available: number, rowHeight: number, gap: number): number {
  if (rowHeight <= 0 || available <= 0) return 0;
  return Math.max(0, Math.floor((available + gap) / (rowHeight + gap)));
}
