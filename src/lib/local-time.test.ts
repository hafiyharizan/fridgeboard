import { describe, expect, it } from "vitest";
import { getLocalDateTime, isReminderDue } from "@/lib/local-time";

describe("getLocalDateTime", () => {
  it("converts UTC to Perth (UTC+8, no DST)", () => {
    // 23:05 UTC on 2 Nov = 07:05 on 3 Nov in Perth
    expect(getLocalDateTime(new Date("2026-11-02T23:05:00Z"), "Australia/Perth")).toEqual({
      dateKey: "2026-11-03",
      minutes: 7 * 60 + 5,
    });
  });

  it("handles local midnight", () => {
    expect(getLocalDateTime(new Date("2026-11-02T16:00:00Z"), "Australia/Perth")).toEqual({
      dateKey: "2026-11-03",
      minutes: 0,
    });
  });
});

describe("isReminderDue", () => {
  // Event at 09:30, notify 15 min before -> trigger at 09:15 (555)
  it("is due from the trigger time through the catch-up window", () => {
    expect(isReminderDue("09:30", 15, 554)).toBe(false);
    expect(isReminderDue("09:30", 15, 555)).toBe(true);
    expect(isReminderDue("09:30", 15, 570)).toBe(true);
    expect(isReminderDue("09:30", 15, 585)).toBe(true);
    expect(isReminderDue("09:30", 15, 586)).toBe(false);
  });

  it("accepts HH:MM:SS and rejects garbage", () => {
    expect(isReminderDue("09:30:00", 0, 570)).toBe(true);
    expect(isReminderDue("soon", 0, 570)).toBe(false);
  });
});
