// Weather from Open-Meteo (free, no API key). Pure helpers: URL, parsing and
// WMO weather-code labels. Fetching happens in the browser (useWeather).

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export type DayForecast = {
  code: number;
  max: number;
  min: number;
  rainChance: number | null;
  uvMax: number | null;
  /** Local "HH:MM" at the forecast place, when Open-Meteo sends it. */
  sunrise: string | null;
  sunset: string | null;
};

export type Forecast = {
  current: {
    temperature: number;
    apparent: number | null;
    code: number;
    isDay: boolean;
    humidity: number | null;
    wind: number | null;
    uv: number | null;
  };
  today: DayForecast;
  tomorrow: DayForecast | null;
};

export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      "temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m,uv_index",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

export function geocodeUrl(query: string): string {
  const params = new URLSearchParams({ name: query.trim(), count: "6", language: "en", format: "json" });
  return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
}

export type Place = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function at(list: unknown, index: number): number | null {
  return Array.isArray(list) ? num(list[index]) : null;
}

/** "2026-11-04T05:12" → "05:12" (Open-Meteo local time with timezone=auto). */
function clockAt(list: unknown, index: number): string | null {
  const value = Array.isArray(list) ? list[index] : null;
  const match = typeof value === "string" ? value.match(/T(\d{2}:\d{2})/) : null;
  return match ? match[1] : null;
}

/** Defensive parse: returns null if the essentials are missing. */
export function parseForecast(data: unknown): Forecast | null {
  if (!data || typeof data !== "object") return null;
  const { current, daily } = data as { current?: Record<string, unknown>; daily?: Record<string, unknown> };
  if (!current || !daily) return null;
  const temperature = num(current.temperature_2m);
  const code = num(current.weather_code);
  const day = (index: number): DayForecast | null => {
    const max = at(daily.temperature_2m_max, index);
    const min = at(daily.temperature_2m_min, index);
    const dayCode = at(daily.weather_code, index);
    if (max === null || min === null || dayCode === null) return null;
    return {
      code: dayCode,
      max,
      min,
      rainChance: at(daily.precipitation_probability_max, index),
      uvMax: at(daily.uv_index_max, index),
      sunrise: clockAt(daily.sunrise, index),
      sunset: clockAt(daily.sunset, index),
    };
  };
  const today = day(0);
  if (temperature === null || code === null || !today) return null;
  return {
    current: {
      temperature,
      apparent: num(current.apparent_temperature),
      code,
      isDay: current.is_day !== 0,
      humidity: num(current.relative_humidity_2m),
      wind: num(current.wind_speed_10m),
      uv: num(current.uv_index),
    },
    today,
    tomorrow: day(1),
  };
}

export function parsePlaces(data: unknown): Place[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((entry: Record<string, unknown>) => {
    const latitude = num(entry.latitude);
    const longitude = num(entry.longitude);
    if (typeof entry.name !== "string" || latitude === null || longitude === null) return [];
    const region = [entry.admin1, entry.country].filter((part) => typeof part === "string" && part).join(", ");
    return [
      {
        name: region ? `${entry.name}, ${region}` : entry.name,
        latitude,
        longitude,
        timezone: typeof entry.timezone === "string" ? entry.timezone : null,
      },
    ];
  });
}

/** WMO weather interpretation codes → plain words and an icon family. */
export function describeWeather(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "partly" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { label: code >= 80 ? "Showers" : "Rain", kind: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorms", kind: "storm" };
  return { label: "Cloudy", kind: "cloudy" };
}

export function uvLevel(uv: number): string {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

/**
 * One practical line for the household, most important condition first.
 * After dark (`night`), daytime advice like UV and heat is skipped and the
 * line is about tonight instead.
 */
export function weatherTip(forecast: Forecast, night = false): string {
  const { current, today } = forecast;
  const kind = describeWeather(current.code).kind;
  const round = Math.round;
  if (kind === "storm" || (!night && describeWeather(today.code).kind === "storm"))
    return night ? "Storms tonight. Bring the washing in." : "Storms today. Bring the washing in.";
  if (night) {
    const low = round(forecast.tomorrow?.min ?? today.min);
    if (kind === "rain" || kind === "drizzle") return `Rain tonight, down to ${low}°.`;
    if (current.wind !== null && current.wind >= 30) return `Windy tonight at ${round(current.wind)} km/h.`;
    if (low <= 8) return `Cold night, down to ${low}°. Extra blanket.`;
    return `${describeWeather(current.code).label} tonight, down to ${low}°.`;
  }
  if (today.rainChance !== null && today.rainChance >= 60)
    return `Rain likely (${today.rainChance}%). Take an umbrella.`;
  if (today.uvMax !== null && today.uvMax >= 8)
    return `UV up to ${round(today.uvMax)} today. Sunscreen and hats.`;
  if (today.max >= 35) return `Hot, up to ${round(today.max)}°. Keep water handy.`;
  if (current.wind !== null && current.wind >= 30) return `Windy, ${round(current.wind)} km/h. Peg the washing well.`;
  if (today.min <= 8) return `Chilly, down to ${round(today.min)}°. Jackets on.`;
  if (today.uvMax !== null && today.uvMax >= 6) return "High UV at midday. Pack sunscreen.";
  return `Mild day, ${round(today.min)}° to ${round(today.max)}°.`;
}

/* ---------- Sky scene for the Outside card ---------- */

export type SkyPhase = "dawn" | "day" | "dusk" | "night";
export type SkyWeather = "clear" | "partly" | "cloudy" | "fog" | "rain" | "storm" | "snow";
export type SkyScene = { phase: SkyPhase; weather: SkyWeather };

const minutesOf = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
};

/**
 * Time of day for the sky: dawn from 40 min before sunrise to 40 min after,
 * dusk from 50 min before sunset to 30 min after. Without sun times, falls
 * back to Open-Meteo's is_day, then to 6 AM–6 PM.
 */
export function skyPhase(
  now: Date,
  sun: { sunrise: string | null; sunset: string | null } | null,
  isDay?: boolean,
): SkyPhase {
  const clock = now.getHours() * 60 + now.getMinutes();
  if (sun?.sunrise && sun.sunset) {
    const rise = minutesOf(sun.sunrise);
    const set = minutesOf(sun.sunset);
    if (clock >= rise - 40 && clock < rise + 40) return "dawn";
    if (clock >= set - 50 && clock < set + 30) return "dusk";
    return clock >= rise + 40 && clock < set - 50 ? "day" : "night";
  }
  if (isDay !== undefined) return isDay ? "day" : "night";
  return clock >= 360 && clock < 1080 ? "day" : "night";
}

/** What the Outside card's animated sky shows right now. */
export function skyScene(forecast: Forecast | null, now: Date): SkyScene {
  if (!forecast) return { phase: skyPhase(now, null), weather: "clear" };
  const kind = describeWeather(forecast.current.code).kind;
  return {
    phase: skyPhase(now, forecast.today, forecast.current.isDay),
    weather: kind === "drizzle" ? "rain" : kind,
  };
}

/**
 * Whole-app theme: dark from sunset to sunrise at home. Without sun times,
 * falls back to Open-Meteo's is_day, then to 6 AM–6 PM.
 */
export function isDarkTime(
  now: Date,
  sun: { sunrise: string | null; sunset: string | null } | null,
  isDay?: boolean,
): boolean {
  const clock = now.getHours() * 60 + now.getMinutes();
  if (sun?.sunrise && sun.sunset) return clock < minutesOf(sun.sunrise) || clock >= minutesOf(sun.sunset);
  if (isDay !== undefined) return !isDay;
  return clock < 360 || clock >= 1080;
}
