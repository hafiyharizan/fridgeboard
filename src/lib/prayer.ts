// Prayer times, calculated locally with adhan-js (no network needed).
// Shared by the kitchen display and the athan push cron.

import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
} from "adhan";
import type { PrayerMethod } from "@/lib/types";

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const PRAYER_METHODS: { value: PrayerMethod; label: string }[] = [
  { value: "MuslimWorldLeague", label: "Muslim World League" },
  { value: "Singapore", label: "JAKIM / MUIS (Malaysia, Singapore)" },
  { value: "Egyptian", label: "Egyptian General Authority" },
  { value: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { value: "UmmAlQura", label: "Umm al-Qura, Makkah" },
  { value: "Dubai", label: "Dubai" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "Qatar", label: "Qatar" },
  { value: "NorthAmerica", label: "ISNA (North America)" },
  { value: "MoonsightingCommittee", label: "Moonsighting Committee" },
  { value: "Tehran", label: "Tehran" },
  { value: "Turkey", label: "Diyanet (Turkey)" },
];

/** An athan alert stays due this long after its time (cron can run late). */
export const ATHAN_WINDOW_MS = 10 * 60 * 1000;

export type PrayerSlot = { name: PrayerName; label: string; time: Date };

export type DayParts = { year: number; month: number; day: number };

/**
 * The five daily prayers for one calendar day at a place.
 * `day` is that place's calendar date (month 1–12).
 */
export function prayerSchedule(
  latitude: number,
  longitude: number,
  day: DayParts,
  method: PrayerMethod,
  madhab: "shafi" | "hanafi" = "shafi",
): PrayerSlot[] {
  const params = CalculationMethod[method]();
  params.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  // adhan reads the calendar day from the Date's local fields.
  const date = new Date(day.year, day.month - 1, day.day);
  const times = new PrayerTimes(new Coordinates(latitude, longitude), date, params);
  return (Object.keys(PRAYER_LABELS) as PrayerName[]).map((name) => ({
    name,
    label: PRAYER_LABELS[name],
    time: times[name],
  }));
}

/** The first prayer at or after `now`, or null once Isha has passed. */
export function nextPrayer(slots: PrayerSlot[], now: Date): PrayerSlot | null {
  return slots.find((slot) => slot.time.getTime() >= now.getTime()) ?? null;
}

/**
 * What Home shows: today's times until Isha has passed, then tomorrow's,
 * so the highlighted tile and the "next" line always agree.
 */
export function prayerView(today: PrayerSlot[], tomorrow: PrayerSlot[], now: Date) {
  const next = nextPrayer(today, now);
  return next
    ? { today, shown: today, next, nextIsTomorrow: false }
    : { today, shown: tomorrow, next: tomorrow[0] ?? null, nextIsTomorrow: true };
}

/** The prayer whose athan is due right now (within the window), if any. */
export function duePrayer(
  slots: PrayerSlot[],
  now: Date,
  windowMs = ATHAN_WINDOW_MS,
): PrayerSlot | null {
  const t = now.getTime();
  return (
    slots.find((slot) => {
      const start = slot.time.getTime();
      return t >= start && t < start + windowMs;
    }) ?? null
  );
}

/** Calendar date of `date` in an IANA zone (server code runs in UTC). */
export function dayInZone(date: Date, timeZone: string): DayParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function dayKey(day: DayParts): string {
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

/** "in 1 h 20 min", "in 5 min", "now". */
export function countdown(target: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `in ${hours} h ${rest} min` : `in ${hours} h`;
}

export function isPrayerMethod(value: unknown): value is PrayerMethod {
  return PRAYER_METHODS.some((method) => method.value === value);
}
