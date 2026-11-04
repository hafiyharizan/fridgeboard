// Weather for the Home hub, from Open-Meteo (free, no key, CORS-enabled).
// Pure helpers live here so they can be unit tested; the fetching hook is
// in hooks/useWeather.ts.

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "storm"
  | "snow";

export type Weather = {
  temperature: number;
  feelsLike: number | null;
  humidity: number | null;
  windKmh: number | null;
  uv: number | null;
  uvMax: number | null;
  high: number | null;
  low: number | null;
  rainChance: number | null;
  code: number;
  isDay: boolean;
  label: string;
  kind: WeatherKind;
};

export type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

const num = (value: unknown, fallback: number) => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
};

/** Defaults to Perth; override with NEXT_PUBLIC_WEATHER_LAT / _LON / _LABEL. */
export function getWeatherLocation(env: Record<string, string | undefined> = {
  lat: process.env.NEXT_PUBLIC_WEATHER_LAT,
  lon: process.env.NEXT_PUBLIC_WEATHER_LON,
  label: process.env.NEXT_PUBLIC_WEATHER_LABEL,
}): WeatherLocation {
  const latitude = num(env.lat, -31.9523);
  const longitude = num(env.lon, 115.8613);
  return {
    latitude: Math.max(-90, Math.min(90, latitude)),
    longitude: Math.max(-180, Math.min(180, longitude)),
    label: env.label?.trim() || "Perth, WA",
  };
}

export function buildForecastUrl({ latitude, longitude }: WeatherLocation) {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,uv_index,is_day",
    daily: "temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1",
    wind_speed_unit: "kmh",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** WMO weather interpretation codes, as used by Open-Meteo. */
export function describeWeatherCode(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "clear" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: "Foggy", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "drizzle" };
  if (code === 61 || code === 80) return { label: "Light rain", kind: "rain" };
  if (code === 63 || code === 81) return { label: "Rain", kind: "rain" };
  if (code === 65 || code === 82 || code === 66 || code === 67) return { label: "Heavy rain", kind: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorms", kind: "storm" };
  return { label: "Cloudy", kind: "cloudy" };
}

const optional = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Turns an Open-Meteo forecast response into Weather, or null if unusable. */
export function parseForecast(json: unknown): Weather | null {
  if (!json || typeof json !== "object") return null;
  const data = json as {
    current?: Record<string, unknown>;
    daily?: Record<string, unknown[]>;
  };
  const current = data.current;
  const temperature = optional(current?.temperature_2m);
  if (!current || temperature === null) return null;
  const code = optional(current.weather_code) ?? 3;
  const first = (key: string) => optional(data.daily?.[key]?.[0]);
  const { label, kind } = describeWeatherCode(code);
  return {
    temperature,
    feelsLike: optional(current.apparent_temperature),
    humidity: optional(current.relative_humidity_2m),
    windKmh: optional(current.wind_speed_10m),
    uv: optional(current.uv_index),
    uvMax: first("uv_index_max"),
    high: first("temperature_2m_max"),
    low: first("temperature_2m_min"),
    rainChance: first("precipitation_probability_max"),
    code,
    isDay: current.is_day !== 0,
    label,
    kind,
  };
}

export function uvLevel(uv: number) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

const round = (value: number) => Math.round(value);

/** One practical line for the household, most important condition first. */
export function weatherTip(weather: Weather): string {
  const { kind, rainChance, uvMax, windKmh, high, low } = weather;
  if (kind === "storm") return "Storms around today. Bring the washing in early.";
  if (rainChance !== null && rainChance >= 60)
    return `Rain likely today (${round(rainChance)}%). Pack an umbrella for the school run.`;
  if (uvMax !== null && uvMax >= 8)
    return `UV peaks at ${round(uvMax)} (${uvLevel(uvMax).toLowerCase()}). Sunscreen and hats before heading out.`;
  if (high !== null && high >= 35) return `Hot one, up to ${round(high)}°. Keep water handy.`;
  if (windKmh !== null && windKmh >= 30) return `Windy at ${round(windKmh)} km/h. Peg the washing well.`;
  if (low !== null && low <= 8) return `Chilly start at ${round(low)}°. Jackets for the morning.`;
  if (uvMax !== null && uvMax >= 6) return "High UV around midday. Sunscreen if you're out.";
  if (high !== null && low !== null) return `Mild day ahead, ${round(low)}° to ${round(high)}°.`;
  return "A settled day ahead.";
}
