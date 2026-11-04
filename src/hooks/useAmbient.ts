"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { watchWake } from "@/hooks/watchWake";
import { dateKey } from "@/lib/dashboard";
import { duePrayer, nextPrayer, prayerSchedule, type PrayerSlot } from "@/lib/prayer";
import { forecastUrl, parseForecast, type Forecast } from "@/lib/weather";
import type { HouseholdSettings } from "@/lib/types";

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_CACHE_KEY = "fridgeboard.weather";

/** Ticks every `ms`; drives clocks, countdowns and the athan check. */
export function useNow(ms: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

type CachedWeather = { place: string; at: number; forecast: Forecast };

function readCache(place: string): CachedWeather | null {
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null") as CachedWeather | null;
    return cached?.place === place ? cached : null;
  } catch {
    return null;
  }
}

/**
 * Current weather and today/tomorrow from Open-Meteo for the household's
 * location. The last good forecast is kept on the device, so a tablet that
 * restarts without wifi still has something to show.
 */
export function useWeather(settings: HouseholdSettings | null) {
  const lat = settings?.latitude ?? null;
  const lon = settings?.longitude ?? null;
  const place = lat !== null && lon !== null ? `${lat.toFixed(3)},${lon.toFixed(3)}` : "";
  const [state, setState] = useState<{ place: string; forecast: Forecast | null; at: number | null; failed: boolean }>({
    place: "",
    forecast: null,
    at: null,
    failed: false,
  });

  useEffect(() => {
    if (!place || lat === null || lon === null) return;
    let alive = true;
    const cached = readCache(place);
    const load = async () => {
      try {
        const response = await fetch(forecastUrl(lat, lon));
        const forecast = parseForecast(await response.json());
        if (!alive) return;
        if (!forecast) throw new Error("Unreadable forecast");
        const at = Date.now();
        setState({ place, forecast, at, failed: false });
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ place, at, forecast }));
        } catch {
          // Storage full or blocked: fine, just no offline copy.
        }
      } catch {
        if (alive) setState((prev) => ({ ...prev, place, failed: true }));
      }
    };
    // Show the cached copy straight away, then refresh.
    const first = window.setTimeout(() => {
      if (cached && alive) setState({ place, forecast: cached.forecast, at: cached.at, failed: false });
      void load();
    }, 0);
    const timer = window.setInterval(load, WEATHER_REFRESH_MS);
    const stop = watchWake(
      () => void load(),
      () => void load(),
    );
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
      stop();
    };
  }, [place, lat, lon]);

  return state.place === place ? state : { place, forecast: null, at: null, failed: false };
}

export type PrayerDay = {
  today: PrayerSlot[];
  next: PrayerSlot | null;
  /** True when `next` is tomorrow's Fajr. */
  nextIsTomorrow: boolean;
};

/** Today's prayer times and the next one, or null when prayer times are off. */
export function usePrayerDay(settings: HouseholdSettings | null, now: Date): PrayerDay | null {
  const lat = settings?.latitude ?? null;
  const lon = settings?.longitude ?? null;
  const enabled = Boolean(settings?.prayer_enabled) && lat !== null && lon !== null;
  const method = settings?.prayer_method ?? "MuslimWorldLeague";
  const madhab = settings?.prayer_madhab ?? "shafi";
  const day = dateKey(now);
  const minute = Math.floor(now.getTime() / 60_000);

  const schedules = useMemo(() => {
    if (!enabled || lat === null || lon === null) return null;
    const [year, month, date] = day.split("-").map(Number);
    const tomorrow = new Date(year, month - 1, date + 1);
    return {
      today: prayerSchedule(lat, lon, { year, month, day: date }, method, madhab),
      tomorrow: prayerSchedule(
        lat,
        lon,
        { year: tomorrow.getFullYear(), month: tomorrow.getMonth() + 1, day: tomorrow.getDate() },
        method,
        madhab,
      ),
    };
  }, [enabled, lat, lon, method, madhab, day]);

  return useMemo(() => {
    if (!schedules) return null;
    const at = new Date(minute * 60_000);
    const next = nextPrayer(schedules.today, at);
    return next
      ? { today: schedules.today, next, nextIsTomorrow: false }
      : { today: schedules.today, next: schedules.tomorrow[0], nextIsTomorrow: true };
  }, [schedules, minute]);
}

/** On the tablet the athan only sounds right at its time, not minutes late. */
const TABLET_ATHAN_WINDOW_MS = 2 * 60 * 1000;
const ATHAN_PLAYED_KEY = "fridgeboard.athan-played";

/**
 * Kitchen display: when a prayer time arrives, returns it (for the banner) and
 * plays /athan.mp3 if the household added one, otherwise a soft chime.
 * Each prayer plays once per day, even across reloads.
 */
export function useAthan(prayer: PrayerDay | null, active: boolean, now: Date) {
  const [current, setCurrent] = useState<PrayerSlot | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const due = prayer && active ? duePrayer(prayer.today, now, TABLET_ATHAN_WINDOW_MS) : null;
  const dueKey = due ? `${dateKey(now)}-${due.name}` : null;

  useEffect(() => {
    if (!due || !dueKey) return;
    let played: string | null = null;
    try {
      played = localStorage.getItem(ATHAN_PLAYED_KEY);
    } catch {
      // Storage blocked: may replay after a reload, which is acceptable.
    }
    if (played === dueKey) return;
    try {
      localStorage.setItem(ATHAN_PLAYED_KEY, dueKey);
    } catch {
      // See above.
    }
    const show = window.setTimeout(() => setCurrent(due), 0);
    const sound = new Audio("/athan.mp3");
    audio.current = sound;
    sound.play().catch(() => playChime());
    return () => window.clearTimeout(show);
  }, [due, dueKey]);

  // Banner stays up for 5 minutes unless dismissed.
  useEffect(() => {
    if (!current) return;
    const hide = window.setTimeout(() => setCurrent(null), 5 * 60 * 1000);
    return () => window.clearTimeout(hide);
  }, [current]);

  return {
    athan: current,
    dismiss: () => {
      audio.current?.pause();
      setCurrent(null);
    },
  };
}

/** Three gentle bell tones from the Web Audio API (no file needed). */
function playChime() {
  try {
    const context = new AudioContext();
    [0, 0.9, 1.8].forEach((offset, index) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value = [659.25, 587.33, 523.25][index];
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 1.6);
      osc.connect(gain).connect(context.destination);
      osc.start(context.currentTime + offset);
      osc.stop(context.currentTime + offset + 1.7);
    });
    window.setTimeout(() => void context.close(), 4000);
  } catch {
    // Audio not allowed yet (no interaction since load): the banner still shows.
  }
}
