import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  daysSince,
  guessRoutine,
  lastDoneLabel,
  needsDoing,
  repeatLabel,
  routineState,
  sortRoutines,
} from "./routine";
import type { Item } from "./types";

const now = new Date(2026, 10, 6, 9, 0); // 6 Nov 2026, 9 AM local

const daysAgo = (days: number, hour = 20) =>
  new Date(2026, 10, 6 - days, hour, 0).toISOString();

const item = (overrides: Partial<Item>): Item => ({
  id: "one",
  list_id: "list",
  text: "Change bed sheets",
  is_checked: false,
  checked_at: null,
  created_at: daysAgo(30),
  is_routine: true,
  repeat_days: null,
  last_done_at: null,
  last_done_by: null,
  ...overrides,
});

describe("daysSince", () => {
  it("counts calendar days, not 24-hour blocks", () => {
    // Last night at 8 PM is "yesterday" even though it's under 24 hours.
    expect(daysSince(daysAgo(1, 20), now)).toBe(1);
    expect(daysSince(daysAgo(0, 7), now)).toBe(0);
    expect(daysSince(daysAgo(10), now)).toBe(10);
  });

  it("is null when never done or unreadable", () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince("not a date", now)).toBeNull();
  });

  it("never goes negative for a clock slightly ahead", () => {
    expect(daysSince(new Date(2026, 10, 7, 1).toISOString(), now)).toBe(0);
  });
});

describe("lastDoneLabel", () => {
  it("reads naturally", () => {
    expect(lastDoneLabel(null)).toBe("Not done yet");
    expect(lastDoneLabel(0)).toBe("Today");
    expect(lastDoneLabel(1)).toBe("Yesterday");
    expect(lastDoneLabel(9)).toBe("9 days ago");
    expect(lastDoneLabel(15)).toBe("2 weeks ago");
    expect(lastDoneLabel(75)).toBe("2 months ago");
    expect(lastDoneLabel(400)).toBe("Over a year ago");
    expect(lastDoneLabel(800)).toBe("2 years ago");
  });
});

describe("repeatLabel", () => {
  it("uses the preset names and falls back to days", () => {
    expect(repeatLabel(null)).toBeNull();
    expect(repeatLabel(7)).toBe("Every week");
    expect(repeatLabel(10)).toBe("Every 10 days");
    expect(repeatLabel(1)).toBe("Every day");
  });
});

describe("routineState", () => {
  it("is unscheduled without a repeat", () => {
    expect(routineState(item({ last_done_at: daysAgo(40) }), now)).toBe("unscheduled");
  });

  it("is ok, due, then overdue as days pass", () => {
    expect(routineState(item({ repeat_days: 7, last_done_at: daysAgo(3) }), now)).toBe("ok");
    expect(routineState(item({ repeat_days: 7, last_done_at: daysAgo(7) }), now)).toBe("due");
    expect(routineState(item({ repeat_days: 7, last_done_at: daysAgo(9) }), now)).toBe("overdue");
  });

  it("is due when scheduled but never done", () => {
    expect(routineState(item({ repeat_days: 7 }), now)).toBe("due");
    expect(needsDoing(item({ repeat_days: 7 }), now)).toBe(true);
    expect(needsDoing(item({}), now)).toBe(false);
  });

  it("counts how far overdue", () => {
    expect(daysOverdue(item({ repeat_days: 7, last_done_at: daysAgo(10) }), now)).toBe(3);
    expect(daysOverdue(item({ repeat_days: 7, last_done_at: daysAgo(2) }), now)).toBe(0);
  });
});

describe("sortRoutines", () => {
  it("puts the most overdue first, relative to the schedule", () => {
    const sorted = sortRoutines(
      [
        item({ id: "fresh", repeat_days: 7, last_done_at: daysAgo(1) }),
        item({ id: "car", repeat_days: 14, last_done_at: daysAgo(20) }), // 1.4× late
        item({ id: "sheets", repeat_days: 7, last_done_at: daysAgo(14) }), // 2× late
        item({ id: "loose", last_done_at: daysAgo(3) }),
        item({ id: "due", repeat_days: 7, last_done_at: daysAgo(7) }),
      ],
      now,
    );
    expect(sorted.map((entry) => entry.id)).toEqual(["sheets", "car", "due", "loose", "fresh"]);
  });
});

describe("guessRoutine", () => {
  it("recognises typical chores", () => {
    expect(guessRoutine("Change bed sheets")).toEqual({ days: 7 });
    expect(guessRoutine("Wash the car")).toEqual({ days: 14 });
    expect(guessRoutine("car wash")).toEqual({ days: 14 });
    expect(guessRoutine("Do laundry")).toEqual({ days: 7 });
    expect(guessRoutine("Clean aircon filter")).toEqual({ days: 90 });
    expect(guessRoutine("Vacuuming")).toEqual({ days: 7 });
  });

  it("ignores one-off tasks", () => {
    expect(guessRoutine("Call plumber")).toBeUndefined();
    expect(guessRoutine("Book flights to KL")).toBeUndefined();
    expect(guessRoutine("ca")).toBeUndefined();
  });
});
