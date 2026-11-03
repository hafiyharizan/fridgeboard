import { describe, expect, it } from "vitest";
import { burnInOffset, describeSync, isNewVersion, isNightTime } from "@/lib/kitchen";

const at = (hour: number, minute = 0) => new Date(2026, 10, 3, hour, minute);

describe("isNightTime", () => {
  it("covers 22:00 through 05:59", () => {
    expect(isNightTime(at(21, 59))).toBe(false);
    expect(isNightTime(at(22))).toBe(true);
    expect(isNightTime(at(0, 30))).toBe(true);
    expect(isNightTime(at(5, 59))).toBe(true);
    expect(isNightTime(at(6))).toBe(false);
    expect(isNightTime(at(13))).toBe(false);
  });
  it("supports a window that doesn't cross midnight", () => {
    expect(isNightTime(at(2), 1, 5)).toBe(true);
    expect(isNightTime(at(6), 1, 5)).toBe(false);
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
