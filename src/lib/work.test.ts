import { describe, expect, it } from "vitest";
import {
  addDays,
  atWorkNow,
  awayRanges,
  formatShift,
  homeSummary,
  homeSummaryText,
  isOvernight,
  mondayOf,
  weekOf,
} from "./work";

const shift = (user_id: string, shift_date: string, start_time: string, end_time: string) => ({
  user_id,
  shift_date,
  start_time,
  end_time,
});

describe("week helpers", () => {
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sunday
  });

  it("lists Monday to Sunday, across month ends", () => {
    expect(weekOf("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("shifts", () => {
  it("formats and spots overnight shifts", () => {
    expect(formatShift({ start_time: "09:00", end_time: "17:30" })).toBe("9:00 AM – 5:30 PM");
    expect(isOvernight({ start_time: "22:00", end_time: "06:00" })).toBe(true);
    expect(isOvernight({ start_time: "09:00", end_time: "17:00" })).toBe(false);
  });

  it("carries an overnight shift into the next morning", () => {
    const ranges = awayRanges([shift("a", "2026-11-03", "22:00", "06:00")], "2026-11-04");
    expect(ranges.get("a")).toEqual([[0, 360]]);
    const sameDay = awayRanges([shift("a", "2026-11-04", "22:00", "06:00")], "2026-11-04");
    expect(sameDay.get("a")).toEqual([[1320, 1440]]);
  });
});

describe("homeSummary", () => {
  it("is home all day with no shifts", () => {
    expect(homeSummary([], "2026-11-04")).toEqual({ kind: "all-day" });
    expect(homeSummaryText({ kind: "all-day" })).toBe("Everyone home all day");
  });

  it("spans the earliest start to the latest finish", () => {
    const summary = homeSummary(
      [shift("a", "2026-11-04", "09:00", "17:00"), shift("b", "2026-11-04", "07:30", "15:00")],
      "2026-11-04",
    );
    expect(summary).toEqual({ kind: "partly", until: "07:30", from: "17:00" });
    expect(homeSummaryText(summary)).toBe("Everyone home until 7:30 AM · all home from 5:00 PM");
  });

  it("handles shifts past midnight", () => {
    const night = homeSummary([shift("a", "2026-11-04", "18:00", "02:00")], "2026-11-04");
    expect(night).toEqual({ kind: "partly", until: "18:00", from: null });
    expect(homeSummaryText(night)).toBe("Everyone home until 6:00 PM · someone's out until late");
    const morning = homeSummary([shift("a", "2026-11-03", "18:00", "02:00")], "2026-11-04");
    expect(homeSummaryText(morning)).toBe("All home from 2:00 AM");
  });
});

describe("atWorkNow", () => {
  it("lists who is at work and until when", () => {
    const shifts = [shift("a", "2026-11-04", "09:00", "17:00"), shift("b", "2026-11-04", "18:00", "02:00")];
    expect([...atWorkNow(shifts, new Date(2026, 10, 4, 10, 0))]).toEqual([["a", "17:00"]]);
    expect([...atWorkNow(shifts, new Date(2026, 10, 4, 20, 0))]).toEqual([["b", "late"]]);
    expect([...atWorkNow(shifts, new Date(2026, 10, 5, 1, 0))]).toEqual([["b", "02:00"]]);
    expect(atWorkNow(shifts, new Date(2026, 10, 4, 17, 0)).size).toBe(0);
  });
});
