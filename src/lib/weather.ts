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
};

export type Forecast = {
  current: {
    temperature: number;
    apparent: number | null;
    code: number;
    isDay: boolean;
    humidity: number | null;
    wind: number | null;
  };
  today: DayForecast;
  tomorrow: DayForecast | null;
};

export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current:
      "temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
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
