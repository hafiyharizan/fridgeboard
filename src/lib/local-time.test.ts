import { describe, expect, it } from "vitest";
import {
  getLocalDateTime,
  isReminderDue,
  reminderTriggerAt,
  safeTimeZone,
  zonedTime,
} from "@/lib/local-time";

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

describe("zonedTime", () => {
  it("turns a Perth wall time into the UTC moment", () => {
    expect(zonedTime("2026-11-03", "09:30", "Australia/Perth")?.toISOString()).toBe("2026-11-03T01:30:00.000Z");
  });

  it("follows daylight saving", () => {
    // Sydney is UTC+11 in November, UTC+10 in June.
    expect(zonedTime("2026-11-03", "09:00", "Australia/Sydney")?.toISOString()).toBe("2026-11-02T22:00:00.000Z");
    expect(zonedTime("2026-06-03", "09:00", "Australia/Sydney")?.toISOString()).toBe("2026-06-02T23:00:00.000Z");
  });

  it("accepts HH:MM:SS and rejects garbage", () => {
    expect(zonedTime("2026-11-03", "09:30:00", "Australia/Perth")?.toISOString()).toBe("2026-11-03T01:30:00.000Z");
    expect(zonedTime("2026-11-03", "soon", "Australia/Perth")).toBeNull();
    expect(zonedTime("2026-11-03", "25:00", "Australia/Perth")).toBeNull();
    expect(zonedTime("3 Nov", "09:30", "Australia/Perth")).toBeNull();
  });
});

describe("safeTimeZone", () => {
  it("keeps known zones and falls back for unknown ones", () => {
    expect(safeTimeZone("Asia/Kuala_Lumpur")).toBe("Asia/Kuala_Lumpur");
    expect(safeTimeZone("Mars/Olympus")).toBe("Australia/Perth");
    expect(safeTimeZone(null)).toBe("Australia/Perth");
  });
});

describe("reminderTriggerAt / isReminderDue", () => {
  const perth = "Australia/Perth";
  // Event at 09:30 Perth, notify 15 min before -> trigger 09:15 Perth = 01:15 UTC.
  const event = { event_date: "2026-11-03", event_time: "09:30", notify_before: 15 };
  const trigger = reminderTriggerAt(event, perth);

  it("is due from the trigger time through the catch-up window", () => {
    expect(trigger?.toISOString()).toBe("2026-11-03T01:15:00.000Z");
    expect(isReminderDue(trigger, new Date("2026-11-03T01:14:00Z"))).toBe(false);
    expect(isReminderDue(trigger, new Date("2026-11-03T01:15:00Z"))).toBe(true);
    expect(isReminderDue(trigger, new Date("2026-11-03T01:45:00Z"))).toBe(true);
    expect(isReminderDue(trigger, new Date("2026-11-03T01:46:00Z"))).toBe(false);
  });

  it("fires the evening before for an early-morning event", () => {
    const early = reminderTriggerAt({ event_date: "2026-11-04", event_time: "00:30", notify_before: 60 }, perth);
    expect(early?.toISOString()).toBe("2026-11-03T15:30:00.000Z"); // 23:30 on the 3rd in Perth
  });

  it("has no trigger without a time or with reminders off", () => {
    expect(reminderTriggerAt({ ...event, event_time: null }, perth)).toBeNull();
    expect(reminderTriggerAt({ ...event, notify_before: -1 }, perth)).toBeNull();
    expect(isReminderDue(null, new Date())).toBe(false);
  });
});
