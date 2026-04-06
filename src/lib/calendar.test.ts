import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getDaysInMonth,
  getFirstDayOfWeek,
  formatDateKey,
  isToday,
  getMonthName,
  getMonthRange,
  expandRecurrences,
  RECURRENCE_LABELS,
  WEEKDAYS,
} from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    pin_code: "1234",
    event_date: "2026-03-01",
    event_time: null,
    title: "Test event",
    note: null,
    event_type: "event",
    color: "blue",
    is_done: false,
    recurrence: "none",
    recurrence_end: null,
    notify_before: -1,
    notify_channels: [],
    created_at: "2026-01-01T00:00:00Z",
    source_type: "manual",
    source_label: null,
    source_event_id: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDaysInMonth
// ---------------------------------------------------------------------------

describe("getDaysInMonth", () => {
  it("returns 31 for January", () => expect(getDaysInMonth(2026, 0)).toBe(31));
  it("returns 28 for February in a non-leap year", () => expect(getDaysInMonth(2026, 1)).toBe(28));
  it("returns 29 for February in a leap year", () => expect(getDaysInMonth(2024, 1)).toBe(29));
  it("returns 30 for April", () => expect(getDaysInMonth(2026, 3)).toBe(30));
  it("returns 31 for December", () => expect(getDaysInMonth(2026, 11)).toBe(31));
});

// ---------------------------------------------------------------------------
// getFirstDayOfWeek
// ---------------------------------------------------------------------------

describe("getFirstDayOfWeek", () => {
  it("returns correct day-of-week for a known month start (2026-03-01 is a Sunday = 0)", () => {
    expect(getFirstDayOfWeek(2026, 2)).toBe(0);
  });
  it("returns correct day-of-week for 2026-01-01 (Thursday = 4)", () => {
    expect(getFirstDayOfWeek(2026, 0)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// formatDateKey
// ---------------------------------------------------------------------------

describe("formatDateKey", () => {
  it("pads month and day with leading zeros", () => {
    expect(formatDateKey(2026, 0, 5)).toBe("2026-01-05");
  });
  it("handles double-digit month and day", () => {
    expect(formatDateKey(2026, 11, 31)).toBe("2026-12-31");
  });
  it("converts 0-indexed month correctly", () => {
    expect(formatDateKey(2026, 2, 28)).toBe("2026-03-28");
  });
});

// ---------------------------------------------------------------------------
// isToday
// ---------------------------------------------------------------------------

describe("isToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns true for today's date", () => {
    expect(isToday(2026, 2, 28)).toBe(true);
  });
  it("returns false for yesterday", () => {
    expect(isToday(2026, 2, 27)).toBe(false);
  });
  it("returns false for a different month", () => {
    expect(isToday(2026, 3, 28)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getMonthName
// ---------------------------------------------------------------------------

describe("getMonthName", () => {
  it("returns January for 0", () => expect(getMonthName(0)).toBe("January"));
  it("returns December for 11", () => expect(getMonthName(11)).toBe("December"));
  it("returns March for 2", () => expect(getMonthName(2)).toBe("March"));
});

// ---------------------------------------------------------------------------
// WEEKDAYS constant
// ---------------------------------------------------------------------------

describe("WEEKDAYS", () => {
  it("has 7 entries starting with Sun", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS[0]).toBe("Sun");
    expect(WEEKDAYS[6]).toBe("Sat");
  });
});

// ---------------------------------------------------------------------------
// RECURRENCE_LABELS
// ---------------------------------------------------------------------------

describe("RECURRENCE_LABELS", () => {
  it("covers all recurrence values", () => {
    const keys = Object.keys(RECURRENCE_LABELS);
    expect(keys).toContain("none");
    expect(keys).toContain("daily");
    expect(keys).toContain("weekly");
    expect(keys).toContain("biweekly");
    expect(keys).toContain("monthly");
    expect(keys).toContain("yearly");
  });
});

// ---------------------------------------------------------------------------
// getMonthRange
// ---------------------------------------------------------------------------

describe("getMonthRange", () => {
  it("returns correct range for March 2026", () => {
    expect(getMonthRange(2026, 2)).toEqual({ start: "2026-03-01", end: "2026-03-31" });
  });
  it("returns correct range for February 2024 (leap year)", () => {
    expect(getMonthRange(2024, 1)).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("returns correct range for April 2026 (30 days)", () => {
    expect(getMonthRange(2026, 3)).toEqual({ start: "2026-04-01", end: "2026-04-30" });
  });
});

// ---------------------------------------------------------------------------
// expandRecurrences
// ---------------------------------------------------------------------------

describe("expandRecurrences — non-recurring", () => {
  it("includes event when it falls within range", () => {
    const event = makeEvent({ event_date: "2026-03-15" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    expect(result).toHaveLength(1);
    expect(result[0].occurrence_date).toBe("2026-03-15");
    expect(result[0].is_recurrence).toBe(false);
  });

  it("excludes event outside range", () => {
    const event = makeEvent({ event_date: "2026-04-05" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    expect(result).toHaveLength(0);
  });
});

describe("expandRecurrences — daily", () => {
  it("generates one occurrence per day across a week", () => {
    const event = makeEvent({ event_date: "2026-03-01", recurrence: "daily" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-07");
    expect(result).toHaveLength(7);
    expect(result[0].occurrence_date).toBe("2026-03-01");
    expect(result[6].occurrence_date).toBe("2026-03-07");
  });

  it("respects recurrence_end", () => {
    const event = makeEvent({
      event_date: "2026-03-01",
      recurrence: "daily",
      recurrence_end: "2026-03-03",
    });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    expect(result).toHaveLength(3);
    expect(result[2].occurrence_date).toBe("2026-03-03");
  });
});

describe("expandRecurrences — weekly", () => {
  it("generates one occurrence per week", () => {
    const event = makeEvent({ event_date: "2026-03-02", recurrence: "weekly" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    const dates = result.map((e) => e.occurrence_date);
    expect(dates).toEqual(["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23", "2026-03-30"]);
  });

  it("marks original occurrence as is_recurrence: false", () => {
    const event = makeEvent({ event_date: "2026-03-02", recurrence: "weekly" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    expect(result[0].is_recurrence).toBe(false);
    expect(result[1].is_recurrence).toBe(true);
  });
});

describe("expandRecurrences — biweekly", () => {
  it("generates one occurrence every 14 days", () => {
    const event = makeEvent({ event_date: "2026-03-01", recurrence: "biweekly" });
    const result = expandRecurrences([event], "2026-03-01", "2026-03-31");
    const dates = result.map((e) => e.occurrence_date);
    expect(dates).toEqual(["2026-03-01", "2026-03-15", "2026-03-29"]);
  });
});

describe("expandRecurrences — monthly", () => {
  it("generates one occurrence per month over a quarter", () => {
    const event = makeEvent({ event_date: "2026-01-15", recurrence: "monthly" });
    const result = expandRecurrences([event], "2026-01-01", "2026-03-31");
    const dates = result.map((e) => e.occurrence_date);
    expect(dates).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });
});

describe("expandRecurrences — yearly", () => {
  it("generates one occurrence per year over two years", () => {
    const event = makeEvent({ event_date: "2024-06-15", recurrence: "yearly" });
    const result = expandRecurrences([event], "2024-01-01", "2026-12-31");
    const dates = result.map((e) => e.occurrence_date);
    expect(dates).toEqual(["2024-06-15", "2025-06-15", "2026-06-15"]);
  });
});

describe("expandRecurrences — output ordering", () => {
  it("returns events sorted by occurrence_date", () => {
    const events = [
      makeEvent({ id: "b", event_date: "2026-03-20" }),
      makeEvent({ id: "a", event_date: "2026-03-05" }),
      makeEvent({ id: "c", event_date: "2026-03-10" }),
    ];
    const result = expandRecurrences(events, "2026-03-01", "2026-03-31");
    expect(result.map((e) => e.occurrence_date)).toEqual([
      "2026-03-05",
      "2026-03-10",
      "2026-03-20",
    ]);
  });
});
