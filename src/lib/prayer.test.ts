import { describe, expect, it } from "vitest";
import { countdown, dayInZone, dayKey, duePrayer, isPrayerMethod, nextPrayer, prayerSchedule } from "@/lib/prayer";

const PERTH = { lat: -31.9523, lon: 115.8613 };
const day = { year: 2026, month: 11, day: 3 };

/** Hours (local Perth, UTC+8) of an instant. */
const perthHour = (date: Date) => ((date.getUTCHours() + 8) % 24) + date.getUTCMinutes() / 60;

describe("prayer times", () => {
  const slots = prayerSchedule(PERTH.lat, PERTH.lon, day, "MuslimWorldLeague");

  it("returns the five prayers in order on the right day", () => {
    expect(slots.map((slot) => slot.name)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].time.getTime()).toBeGreaterThan(slots[i - 1].time.getTime());
    }
    // Perth solar noon in early November is just before midday.
    expect(perthHour(slots[1].time)).toBeGreaterThan(11.5);
    expect(perthHour(slots[1].time)).toBeLessThan(12.5);
    expect(perthHour(slots[0].time)).toBeGreaterThan(3.5);
    expect(perthHour(slots[0].time)).toBeLessThan(5);
    expect(perthHour(slots[3].time)).toBeGreaterThan(18);
    expect(perthHour(slots[3].time)).toBeLessThan(19.5);
  });

  it("puts Hanafi Asr later than Shafi", () => {
    const hanafi = prayerSchedule(PERTH.lat, PERTH.lon, day, "MuslimWorldLeague", "hanafi");
    expect(hanafi[2].time.getTime()).toBeGreaterThan(slots[2].time.getTime());
  });

  it("finds the next and the due prayer", () => {
    const asr = slots[2].time;
    expect(nextPrayer(slots, new Date(asr.getTime() - 60_000))?.name).toBe("asr");
    expect(nextPrayer(slots, new Date(slots[4].time.getTime() + 60_000))).toBeNull();
    expect(duePrayer(slots, new Date(asr.getTime() + 5 * 60_000))?.name).toBe("asr");
    expect(duePrayer(slots, new Date(asr.getTime() + 11 * 60_000))).toBeNull();
    expect(duePrayer(slots, new Date(asr.getTime() - 1000))).toBeNull();
  });

  it("works out the household's calendar day on a UTC server", () => {
    // 20:30 UTC on 2 Nov is 04:30 on 3 Nov in Perth.
    const instant = new Date("2026-11-02T20:30:00Z");
    expect(dayInZone(instant, "Australia/Perth")).toEqual(day);
    expect(dayKey(dayInZone(instant, "UTC"))).toBe("2026-11-02");
  });

  it("formats countdowns", () => {
    const now = new Date("2026-11-03T10:00:00Z");
    expect(countdown(new Date(now.getTime() + 20_000), now)).toBe("now");
    expect(countdown(new Date(now.getTime() + 5 * 60_000), now)).toBe("in 5 min");
    expect(countdown(new Date(now.getTime() + 80 * 60_000), now)).toBe("in 1 h 20 min");
    expect(countdown(new Date(now.getTime() + 120 * 60_000), now)).toBe("in 2 h");
  });

  it("validates method names", () => {
    expect(isPrayerMethod("Singapore")).toBe(true);
    expect(isPrayerMethod("Made up")).toBe(false);
  });
});
