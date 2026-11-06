import type { Item } from "@/lib/types";

/**
 * Routines: to-dos that come back (change bed sheets, wash the car).
 * Ticking one doesn't clear it; it records when it was last done, so the
 * list can say "8 days ago" and flag it once it's past its "every N days".
 */

export const REPEAT_CHOICES: { days: number | null; label: string }[] = [
  { days: null, label: "No schedule" },
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Every month" },
  { days: 90, label: "Every 3 months" },
  { days: 180, label: "Every 6 months" },
];

export function isRoutine(item: Item): boolean {
  return item.is_routine === true;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight, so "days ago" counts calendar days, not 24-hour blocks. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days since it was last done; null if never. */
export function daysSince(lastDoneAt: string | null | undefined, now: Date): number | null {
  if (!lastDoneAt) return null;
  const done = new Date(lastDoneAt);
  if (Number.isNaN(done.getTime())) return null;
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(done)) / DAY_MS));
}

/** "Today", "Yesterday", "5 days ago", "3 weeks ago", "2 months ago", "Not done yet". */
export function lastDoneLabel(days: number | null): string {
  if (days === null) return "Not done yet";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "Over a year ago" : `${years} years ago`;
}

/** "Every week", "Every 10 days"… */
export function repeatLabel(repeatDays: number | null | undefined): string | null {
  if (!repeatDays) return null;
  const preset = REPEAT_CHOICES.find((choice) => choice.days === repeatDays);
  if (preset) return preset.label;
  return repeatDays === 1 ? "Every day" : `Every ${repeatDays} days`;
}

export type RoutineState = "ok" | "due" | "overdue" | "unscheduled";

/**
 * "due" on the day it falls due (or never done with a schedule),
 * "overdue" once past it, "unscheduled" with no "every N days".
 */
export function routineState(item: Item, now: Date): RoutineState {
  const every = item.repeat_days ?? null;
  if (!every) return "unscheduled";
  const days = daysSince(item.last_done_at, now);
  if (days === null) return "due";
  if (days > every) return "overdue";
  if (days === every) return "due";
  return "ok";
}

/** Days past its schedule (0 when not overdue). */
export function daysOverdue(item: Item, now: Date): number {
  const every = item.repeat_days ?? null;
  const days = daysSince(item.last_done_at, now);
  if (!every || days === null) return 0;
  return Math.max(0, days - every);
}

/** Needs attention on Home: due or overdue. */
export function needsDoing(item: Item, now: Date): boolean {
  const state = routineState(item, now);
  return state === "due" || state === "overdue";
}

/**
 * Most pressing first: overdue (by how far past schedule, relative to the
 * schedule), then due, then the rest by longest since done.
 */
export function sortRoutines(items: Item[], now: Date): Item[] {
  const rank = (item: Item) => {
    const state = routineState(item, now);
    return state === "overdue" ? 0 : state === "due" ? 1 : 2;
  };
  const lateness = (item: Item) => {
    const every = item.repeat_days ?? 0;
    const days = daysSince(item.last_done_at, now);
    if (days === null) return Number.POSITIVE_INFINITY;
    return every ? days / every : days;
  };
  return [...items].sort(
    (left, right) =>
      rank(left) - rank(right) ||
      lateness(right) - lateness(left) ||
      left.text.localeCompare(right.text),
  );
}

/** Common household chores and how often they usually come round. */
const ROUTINE_HINTS: { pattern: RegExp; days: number | null }[] = [
  { pattern: /\b(bed ?sheets?|sheets|bedding|pillow ?cases?|duvet)\b/, days: 7 },
  { pattern: /\btowels?\b/, days: 7 },
  { pattern: /\b(laundry|washing)\b/, days: 7 },
  { pattern: /\b(vacuum|hoover|mop|mopping)\w*\b/, days: 7 },
  { pattern: /\b(bins?|rubbish|trash|recycling)\b/, days: 7 },
  { pattern: /\b(bathroom|toilet|shower)\b/, days: 7 },
  { pattern: /\b(wash|clean)\w* (the )?car\b|\bcar ?wash\b/, days: 14 },
  { pattern: /\b(mow|lawn|grass)\b/, days: 14 },
  { pattern: /\bwater (the )?plants\b/, days: 7 },
  { pattern: /\b(clean|wipe)\w* (out )?(the )?(fridge|oven|microwave)\b/, days: 30 },
  { pattern: /\b(dust|dusting)\b/, days: 14 },
  { pattern: /\b(gutters?)\b/, days: 180 },
  { pattern: /\b(air ?con|aircon|a\/c|filters?)\b/, days: 90 },
  { pattern: /\b(oil change|car service|service (the )?car)\b/, days: 180 },
  { pattern: /\b(tyres?|tires?) (pressure|check)\b/, days: 30 },
  { pattern: /\b(smoke alarms?|smoke detectors?)\b/, days: 180 },
  { pattern: /\b(flea|worm)\w* (treatment|tablet)/, days: 30 },
  { pattern: /\b(haircut|hair cut)\b/, days: 30 },
  { pattern: /\b(mattress)\b/, days: 90 },
];

/**
 * Recognises a typical chore as it's typed, so the add form can switch on
 * "Track when it was last done". `undefined` = not a known chore.
 */
export function guessRoutine(text: string): { days: number | null } | undefined {
  const normalised = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalised.length < 3) return undefined;
  const hint = ROUTINE_HINTS.find((entry) => entry.pattern.test(normalised));
  return hint ? { days: hint.days } : undefined;
}
