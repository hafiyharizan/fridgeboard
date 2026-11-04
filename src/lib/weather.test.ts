import { describe, expect, it } from "vitest";
import { describeWeather, forecastUrl, parseForecast, parsePlaces, uvLevel, weatherTip, type Forecast } from "@/lib/weather";

const sample = {
  current: { temperature_2m: 23.4, apparent_temperature: 22, weather_code: 1, is_day: 1, relative_humidity_2m: 48, wind_speed_10m: 12, uv_index: 6.2 },
  daily: {
    weather_code: [1, 61],
    temperature_2m_max: [27.2, 25],
    temperature_2m_min: [15.1, 14],
    precipitation_probability_max: [5, 70],
    uv_index_max: [8.1, 6],
  },
};

describe("weather", () => {
  it("builds a keyless Open-Meteo URL for two days", () => {
    const url = new URL(forecastUrl(-31.9523, 115.8613));
    expect(url.host).toBe("api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("-31.9523");
    expect(url.searchParams.get("forecast_days")).toBe("2");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  it("parses current, today and tomorrow", () => {
    const forecast = parseForecast(sample);
    expect(forecast?.current.temperature).toBe(23.4);
    expect(forecast?.current.isDay).toBe(true);
    expect(forecast?.today).toEqual({ code: 1, max: 27.2, min: 15.1, rainChance: 5, uvMax: 8.1 });
    expect(forecast?.tomorrow?.rainChance).toBe(70);
  });

  it("rejects incomplete or odd payloads", () => {
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({ current: {}, daily: {} })).toBeNull();
    expect(parseForecast({ ...sample, current: { ...sample.current, temperature_2m: "hot" } })).toBeNull();
    const noTomorrow = parseForecast({ ...sample, daily: { ...sample.daily, temperature_2m_max: [27] } });
    expect(noTomorrow?.tomorrow).toBeNull();
  });

  it("labels WMO codes", () => {
    expect(describeWeather(0)).toEqual({ label: "Clear", kind: "clear" });
    expect(describeWeather(3).kind).toBe("cloudy");
    expect(describeWeather(45).kind).toBe("fog");
    expect(describeWeather(53).kind).toBe("drizzle");
    expect(describeWeather(63)).toEqual({ label: "Rain", kind: "rain" });
    expect(describeWeather(81)).toEqual({ label: "Showers", kind: "rain" });
    expect(describeWeather(75).kind).toBe("snow");
    expect(describeWeather(95).kind).toBe("storm");
  });

  it("parses geocoding results with region names", () => {
    const places = parsePlaces({
      results: [
        { name: "Cottesloe", admin1: "Western Australia", country: "Australia", latitude: -31.99, longitude: 115.75, timezone: "Australia/Perth" },
        { name: "Broken", latitude: "x", longitude: 1 },
      ],
    });
    expect(places).toEqual([
      { name: "Cottesloe, Western Australia, Australia", latitude: -31.99, longitude: 115.75, timezone: "Australia/Perth" },
    ]);
    expect(parsePlaces({})).toEqual([]);
  });
});

describe("weather details", () => {
  const base = parseForecast(sample) as Forecast;
  const tweak = (today: Partial<Forecast["today"]>, current: Partial<Forecast["current"]> = {}): Forecast => ({
    ...base,
    today: { ...base.today, ...today },
    current: { ...base.current, ...current },
  });
  it("reads current UV, and copes without it", () => {
    expect(base.current.uv).toBe(6.2);
    expect(parseForecast({ ...sample, current: { ...sample.current, uv_index: undefined } })?.current.uv).toBeNull();
    expect(new URL(forecastUrl(0, 0)).searchParams.get("current")).toContain("uv_index");
  });
  it("labels UV", () => {
    expect(uvLevel(2)).toBe("Low");
    expect(uvLevel(6.2)).toBe("High");
    expect(uvLevel(12)).toBe("Extreme");
  });
  it("gives the most important tip first", () => {
    expect(weatherTip(tweak({}, { code: 95 }))).toMatch(/^Storms/);
    expect(weatherTip(tweak({ rainChance: 80 }))).toBe("Rain likely (80%). Take an umbrella.");
    expect(weatherTip(base)).toBe("UV up to 8 today. Sunscreen and hats.");
    expect(weatherTip(tweak({ uvMax: 3, max: 38 }))).toBe("Hot, up to 38°. Keep water handy.");
    expect(weatherTip(tweak({ uvMax: 3 }, { wind: 35 }))).toBe("Windy, 35 km/h. Peg the washing well.");
    expect(weatherTip(tweak({ uvMax: 3, min: 6 }))).toBe("Chilly, down to 6°. Jackets on.");
    expect(weatherTip(tweak({ uvMax: 6.5 }))).toBe("High UV at midday. Pack sunscreen.");
    expect(weatherTip(tweak({ uvMax: 2 }))).toBe("Mild day, 15° to 27°.");
  });
});
