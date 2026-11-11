import { describe, expect, it } from "vitest";
import {
  burnInOffset,
  describeSync,
  clockMinutes,
  DEFAULT_NIGHT_HOURS,
  DEFAULT_SLEEP_HOURS,
  formatHours,
  idleDimOpacity,
  inHours,
  isNewVersion,
  nextSlide,
  parseFlag,
  parseHours,
  shouldSleep,
} from "@/lib/kitchen";

const at = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute);

describe("clockMinutes", () => {
  it("reads strict 24-hour times only", () => {
    expect(clockMinutes("00:00")).toBe(0);
    expect(clockMinutes("05:30")).toBe(330);
    expect(clockMinutes("23:59")).toBe(1439);
    for (const bad of ["24:00", "9:00", "09:60", "0900", "", "09:00:00", "ab:cd"]) {
      expect(clockMinutes(bad)).toBeNull();
    }
  });
});

describe("parseHours", () => {
  it("round-trips a stored window and falls back on anything unreadable", () => {
    expect(parseHours("21:30-07:00", DEFAULT_NIGHT_HOURS)).toEqual({ start: "21:30", end: "07:00" });
    expect(parseHours(formatHours(DEFAULT_SLEEP_HOURS), DEFAULT_NIGHT_HOURS)).toEqual(DEFAULT_SLEEP_HOURS);
    for (const bad of [null, "", "22:00", "22:00-", "25:00-06:00", "22:00-06:00-07:00", "night"]) {
      expect(parseHours(bad, DEFAULT_NIGHT_HOURS)).toEqual(DEFAULT_NIGHT_HOURS);
    }
  });
});

describe("inHours", () => {
  it("covers the default night, 22:00 through 05:59", () => {
    expect(inHours(at(21, 59), DEFAULT_NIGHT_HOURS)).toBe(false);
    expect(inHours(at(22), DEFAULT_NIGHT_HOURS)).toBe(true);
    expect(inHours(at(0, 30), DEFAULT_NIGHT_HOURS)).toBe(true);
    expect(inHours(at(5, 59), DEFAULT_NIGHT_HOURS)).toBe(true);
    expect(inHours(at(6), DEFAULT_NIGHT_HOURS)).toBe(false);
    expect(inHours(at(13), DEFAULT_NIGHT_HOURS)).toBe(false);
  });
  it("works to the minute across midnight", () => {
    expect(inHours(at(22, 59), DEFAULT_SLEEP_HOURS)).toBe(false);
    expect(inHours(at(23), DEFAULT_SLEEP_HOURS)).toBe(true);
    expect(inHours(at(5, 29), DEFAULT_SLEEP_HOURS)).toBe(true);
    expect(inHours(at(5, 30), DEFAULT_SLEEP_HOURS)).toBe(false);
  });
  it("supports a window that doesn't cross midnight", () => {
    const hours = { start: "01:00", end: "05:00" };
    expect(inHours(at(2), hours)).toBe(true);
    expect(inHours(at(0, 59), hours)).toBe(false);
    expect(inHours(at(5), hours)).toBe(false);
  });
  it("treats equal or unreadable times as no window", () => {
    expect(inHours(at(3), { start: "03:00", end: "03:00" })).toBe(false);
    expect(inHours(at(3), { start: "nope", end: "06:00" })).toBe(false);
  });
});

describe("shouldSleep", () => {
  const base = { enabled: true, idle: true, now: at(2), hours: DEFAULT_SLEEP_HOURS };
  it("sleeps only when switched on, idle and inside the window", () => {
    expect(shouldSleep(base)).toBe(true);
    expect(shouldSleep({ ...base, enabled: false })).toBe(false);
    expect(shouldSleep({ ...base, idle: false })).toBe(false);
    expect(shouldSleep({ ...base, now: at(12) })).toBe(false);
  });
});

describe("burnInOffset", () => {
  it("stays within 3px and holds steady for ten minutes", () => {
    const start = new Date(Date.UTC(2026, 10, 3, 10, 0));
    const same = new Date(start.getTime() + 9 * 60_000);
    expect(burnInOffset(same)).toEqual(burnInOffset(start));
    for (let i = 0; i < 20; i++) {
      const { x, y } = burnInOffset(new Date(start.getTime() + i * 10 * 60_000));
      expect(Math.abs(x)).toBeLessThanOrEqual(3);
      expect(Math.abs(y)).toBeLessThanOrEqual(3);
    }
  });
  it("moves over time", () => {
    const start = new Date(Date.UTC(2026, 10, 3, 10, 0));
    const later = new Date(start.getTime() + 10 * 60_000);
    expect(burnInOffset(later)).not.toEqual(burnInOffset(start));
  });
});

describe("describeSync", () => {
  const now = 1_000_000_000;
  it("says Live when connected and fresh", () => expect(describeSync(true, now - 5_000, now)).toBe("Live"));
  it("shows age once connection drops", () => {
    expect(describeSync(false, now - 5_000, now)).toBe("Synced just now");
    expect(describeSync(false, now - 4 * 60_000, now)).toBe("Synced 4 min ago");
    expect(describeSync(false, now - 125 * 60_000, now)).toBe("Synced 2 h ago");
  });
  it("stays Live on a quiet but connected household", () =>
    expect(describeSync(true, now - 3 * 60 * 60_000, now)).toBe("Live"));
  it("handles nothing loaded yet", () => {
    expect(describeSync(false, null, now)).toBe("Connecting…");
    expect(describeSync(true, null, now)).toBe("Live");
  });
});

describe("isNewVersion", () => {
  it("reloads only for a different known version", () => {
    expect(isNewVersion("abc", "def")).toBe(true);
    expect(isNewVersion("abc", "abc")).toBe(false);
    expect(isNewVersion("dev", "def")).toBe(false);
    expect(isNewVersion("abc", "dev")).toBe(false);
    expect(isNewVersion("abc", "")).toBe(false);
    expect(isNewVersion("abc", undefined)).toBe(false);
  });
});

describe("parseFlag", () => {
  it("falls back when unset and reads 0/1", () => {
    expect(parseFlag(null, true)).toBe(true);
    expect(parseFlag(null, false)).toBe(false);
    expect(parseFlag("0", true)).toBe(false);
    expect(parseFlag("1", false)).toBe(true);
  });
});

describe("nextSlide", () => {
  it("wraps and stays at 0 for one or no photos", () => {
    expect(nextSlide(0, 3)).toBe(1);
    expect(nextSlide(2, 3)).toBe(0);
    expect(nextSlide(0, 1)).toBe(0);
    expect(nextSlide(0, 0)).toBe(0);
  });
});

describe("idleDimOpacity", () => {
  it("is darker at night", () => {
    expect(idleDimOpacity(false)).toBe(0.55);
    expect(idleDimOpacity(true)).toBe(0.75);
    expect(idleDimOpacity(true)).toBeGreaterThan(idleDimOpacity(false));
  });
  it("is fully black while the screen is meant to be off", () => {
    expect(idleDimOpacity(false, true)).toBe(1);
    expect(idleDimOpacity(true, true)).toBe(1);
  });
});
