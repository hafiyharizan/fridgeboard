"use client";

import { useCallback, useEffect, useState } from "react";
import { buildForecastUrl, getWeatherLocation, parseForecast, type Weather } from "@/lib/weather";

const CACHE_KEY = "fridgeboard.weather";
const REFRESH_MS = 30 * 60_000;
const STALE_MS = 3 * 60 * 60_000;

type Cached = { at: number; weather: Weather };

function readCache(): Cached | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    return cached && typeof cached.at === "number" && cached.weather ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(weather: Weather) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), weather }));
  } catch {
    // Private mode or full storage: the live value still shows.
  }
}

/**
 * Current weather for the household's location, refreshed every 30 minutes
 * and when the screen wakes. The last reading is cached so a kitchen tablet
 * shows it straight away after a reload.
 */
export function useWeather() {
  const location = getWeatherLocation();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const url = buildForecastUrl(location);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Weather ${response.status}`);
      const parsed = parseForecast(await response.json());
      if (!parsed) throw new Error("Unexpected weather response");
      setWeather(parsed);
      setUpdatedAt(Date.now());
      setFailed(false);
      writeCache(parsed);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    const cached = readCache();
    let delay = 0;
    if (cached && Date.now() - cached.at < STALE_MS) {
      // Cached values come from our own earlier fetch; show them immediately.
      setWeather(cached.weather);
      setUpdatedAt(cached.at);
      setLoading(false);
      delay = Math.max(0, REFRESH_MS - (Date.now() - cached.at));
    }
    const first = window.setTimeout(() => void refresh(), delay);
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      const last = readCache()?.at ?? 0;
      if (document.visibilityState === "visible" && Date.now() - last > REFRESH_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { weather, updatedAt, loading, failed, location, refresh };
}

export type WeatherState = ReturnType<typeof useWeather>;
