import { describe, expect, it } from "vitest";
import {
  buildForecastUrl,
  describeWeatherCode,
  getWeatherLocation,
  parseForecast,
  uvLevel,
  weatherTip,
  type Weather,
} from "@/lib/weather";

const sample = {
  current: {
    temperature_2m: 23.4,
    apparent_temperature: 22.1,
    relative_humidity_2m: 48,
    weather_code: 1,
    wind_speed_10m: 12.2,
    uv_index: 6.1,
    is_day: 1,
  },
  daily: {
    temperature_2m_max: [27.2],
    temperature_2m_min: [15.1],
    uv_index_max: [7.4],
    precipitation_probability_max: [5],
  },
};

const base: Weather = parseForecast(sample) as Weather;

describe("location", () => {
  it("defaults to Perth", () => {
    expect(getWeatherLocation({})).toEqual({ latitude: -31.9523, longitude: 115.8613, label: "Perth, WA" });
  });
  it("accepts overrides and clamps nonsense", () => {
    expect(getWeatherLocation({ lat: "-32.0", lon: "115.75", label: " Cottesloe " })).toEqual({
      latitude: -32,
      longitude: 115.75,
      label: "Cottesloe",
    });
    expect(getWeatherLocation({ lat: "abc", lon: "999" }).longitude).toBe(180);
  });
  it("builds an Open-Meteo URL", () => {
    const url = new URL(buildForecastUrl(getWeatherLocation({})));
    expect(url.host).toBe("api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("-31.9523");
    expect(url.searchParams.get("current")).toContain("uv_index");
  });
});

describe("parseForecast", () => {
  it("reads current and daily values", () => {
    expect(base).toMatchObject({ temperature: 23.4, humidity: 48, windKmh: 12.2, high: 27.2, low: 15.1, uvMax: 7.4, label: "Mostly clear", kind: "clear", isDay: true });
  });
  it("rejects unusable payloads", () => {
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({ current: {} })).toBeNull();
    expect(parseForecast({ error: true, reason: "bad" })).toBeNull();
  });
  it("tolerates a missing daily block", () => {
    expect(parseForecast({ current: { temperature_2m: 10 } })).toMatchObject({ high: null, kind: "cloudy" });
  });
});

describe("codes and tips", () => {
  it("maps WMO codes", () => {
    expect(describeWeatherCode(0).kind).toBe("clear");
    expect(describeWeatherCode(2).kind).toBe("partly");
    expect(describeWeatherCode(45).kind).toBe("fog");
    expect(describeWeatherCode(53).kind).toBe("drizzle");
    expect(describeWeatherCode(81).kind).toBe("rain");
    expect(describeWeatherCode(95).kind).toBe("storm");
  });
  it("labels UV", () => {
    expect(uvLevel(2)).toBe("Low");
    expect(uvLevel(6.1)).toBe("High");
    expect(uvLevel(11)).toBe("Extreme");
  });
  it("puts the most important condition first", () => {
    expect(weatherTip({ ...base, kind: "storm" })).toMatch(/Storms/);
    expect(weatherTip({ ...base, rainChance: 70 })).toMatch(/Rain likely today \(70%\)/);
    expect(weatherTip({ ...base, uvMax: 9.2 })).toMatch(/UV peaks at 9 \(very high\)/);
    expect(weatherTip({ ...base, uvMax: 3, high: 38 })).toMatch(/Hot one, up to 38°/);
    expect(weatherTip({ ...base, uvMax: 3, windKmh: 35 })).toMatch(/Windy at 35 km\/h/);
    expect(weatherTip({ ...base, uvMax: 3, low: 6 })).toMatch(/Chilly start at 6°/);
    expect(weatherTip(base)).toMatch(/High UV around midday/);
    expect(weatherTip({ ...base, uvMax: 2 })).toBe("Mild day ahead, 15° to 27°.");
  });
});
