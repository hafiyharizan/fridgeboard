import { formatEventTime } from "@/lib/calendar";
import { dateKey } from "@/lib/dashboard";
import type { WorkPlace, WorkShift } from "@/lib/types";

type Shift = Pick<WorkShift, "user_id" | "shift_date" | "start_time" | "end_time">;

const DAY = 24 * 60;

export const WORK_PLACES: { value: WorkPlace; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "home", label: "Work from home" },
  { value: "other", label: "Location" },
];

/** "Office", "Work from home", or the named location; null when the shift doesn't say. */
export function placeLabel(shift: Pick<WorkShift, "work_place" | "location">): string | null {
  if (shift.work_place === "office") return "Office";
  if (shift.work_place === "home") return "Work from home";
  if (shift.work_place === "other") return shift.location?.trim() || "Other location";
  return null;
}

/** YYYY-MM-DD `days` after (or before) `day`. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

/** The Monday of the week `day` falls in. */
export function mondayOf(day: string): string {
  const weekday = new Date(`${day}T12:00:00`).getDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** Monday to Sunday starting at `monday`. */
export function weekOf(monday: string): string[] {
  return Array.from({ length: 7 }, (_, offset) => addDays(monday, offset));
}

export function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(total: number): string {
  const clamped = ((total % DAY) + DAY) % DAY;
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** An end at or before the start means the shift runs past midnight. */
export function isOvernight(shift: Pick<Shift, "start_time" | "end_time">): boolean {
  return toMinutes(shift.end_time) <= toMinutes(shift.start_time);
}

/** "9:00 AM – 5:30 PM" */
export function formatShift(shift: Pick<Shift, "start_time" | "end_time">): string {
  return `${formatEventTime(shift.start_time)} – ${formatEventTime(shift.end_time)}`;
}

/**
 * Minutes of `day` each member spends at work, as [start, end) ranges within
 * 0–1440. Includes the tail of an overnight shift that started the day before.
 */
export function awayRanges(shifts: Shift[], day: string): Map<string, [number, number][]> {
  const yesterday = addDays(day, -1);
  const ranges = new Map<string, [number, number][]>();
  const add = (userId: string, range: [number, number]) => {
    if (range[1] <= range[0]) return;
    ranges.set(userId, [...(ranges.get(userId) ?? []), range]);
  };
  for (const shift of shifts) {
    const start = toMinutes(shift.start_time);
    const end = toMinutes(shift.end_time);
    if (shift.shift_date === day) add(shift.user_id, [start, isOvernight(shift) ? DAY : end]);
    else if (shift.shift_date === yesterday && isOvernight(shift)) add(shift.user_id, [0, end]);
  }
  return ranges;
}

export type HomeSummary =
  | { kind: "all-day" }
  | {
      kind: "partly";
      /** Everyone is home until this time (null = someone is out from midnight). */
      until: string | null;
      /** Everyone is home again from this time (null = not before midnight). */
      from: string | null;
    };

/** When the whole household is home on `day`, from its work shifts. */
export function homeSummary(shifts: Shift[], day: string): HomeSummary {
  const ranges = [...awayRanges(shifts, day).values()].flat();
  if (!ranges.length) return { kind: "all-day" };
  const firstOut = Math.min(...ranges.map(([start]) => start));
  const lastBack = Math.max(...ranges.map(([, end]) => end));
  return {
    kind: "partly",
    until: firstOut > 0 ? fromMinutes(firstOut) : null,
    from: lastBack < DAY ? fromMinutes(lastBack) : null,
  };
}

/** "Everyone home until 8:00 AM · all back from 5:30 PM" */
export function homeSummaryText(summary: HomeSummary): string {
  if (summary.kind === "all-day") return "Everyone home all day";
  const parts: string[] = [];
  if (summary.until) parts.push(`Everyone home until ${formatEventTime(summary.until)}`);
  parts.push(summary.from ? `all home from ${formatEventTime(summary.from)}` : "someone's out until late");
  const text = parts.join(" · ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Members at work at `now` (overnight shifts from yesterday included). */
export function atWorkNow(shifts: Shift[], now: Date): Map<string, string> {
  const today = dateKey(now);
  const clock = now.getHours() * 60 + now.getMinutes();
  const away = new Map<string, string>();
  for (const [userId, ranges] of awayRanges(shifts, today)) {
    const current = ranges.find(([start, end]) => clock >= start && clock < end);
    if (current) away.set(userId, current[1] >= DAY ? "late" : fromMinutes(current[1]));
  }
  return away;
}
