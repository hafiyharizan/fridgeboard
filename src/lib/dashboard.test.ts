import { describe, expect, it } from "vitest";
import {
  defaultScheduleDay,
  eventPhase,
  greeting,
  nextDateKey,
  nextUpEvent,
  pendingItems,
  rowsThatFit,
  upcomingEvents,
  weekDates,
} from "./dashboard";
import type { CalendarEvent, Item } from "./types";

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: "one",
  pin_code: "1234",
  event_date: "2026-12-31",
  event_time: null,
  title: "Dinner",
  note: null,
  event_type: "event",
  color: "green",
  is_done: false,
  recurrence: "none",
  recurrence_end: null,
  notify_before: -1,
  notify_channels: [],
  created_at: "2026-01-01",
  source_type: "manual",
  source_label: null,
  source_event_id: null,
  ...overrides,
});

describe("Home summaries", () => {
  it("includes all seven dates across year boundaries", () => {
    expect(weekDates("2026-12-29")).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
      "2027-01-04",
    ]);
  });
  it("sorts all-day then timed occurrences and excludes completed entries", () => {
    const result = upcomingEvents(
      [
        event({ id: "late", event_time: "18:30" }),
        event({ id: "early", event_time: "09:00" }),
        event({ id: "all" }),
        event({ id: "done", is_done: true }),
      ],
      "2026-12-31",
      "2027-01-06",
    );
    expect(result.map((item) => item.id)).toEqual(["all", "early", "late"]);
  });
  it("expands recurring events beyond their original month without changing source rows", () => {
    const source = event({ event_date: "2026-12-25", recurrence: "weekly" });
    expect(
      upcomingEvents([source], "2026-12-31", "2027-01-06")[0].occurrence_date,
    ).toBe("2027-01-01");
    expect(source.event_date).toBe("2026-12-25");
  });
  it("retains list ordering while hiding completed items", () => {
    const items = [
      { id: "new", is_checked: false },
      { id: "done", is_checked: true },
      { id: "old", is_checked: false },
    ] as Item[];
    expect(pendingItems(items).map((item) => item.id)).toEqual(["new", "old"]);
    expect(items).toHaveLength(3);
  });
});

describe("home helpers", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m);

  it("greets by time of day", () => {
    expect(greeting(at(7))).toBe("Good morning");
    expect(greeting(at(12))).toBe("Good afternoon");
    expect(greeting(at(18))).toBe("Good evening");
    expect(greeting(at(23))).toBe("Good night");
    expect(greeting(at(3))).toBe("Good night");
  });

  it("steps to the next day across month ends", () => {
    expect(nextDateKey("2026-11-03")).toBe("2026-11-04");
    expect(nextDateKey("2026-11-30")).toBe("2026-12-01");
    expect(nextDateKey("2026-12-31")).toBe("2027-01-01");
  });

  it("finds the next event still ahead", () => {
    const events = [
      { id: "a", occurrence_date: "2026-11-03", event_time: "08:15" },
      { id: "b", occurrence_date: "2026-11-03", event_time: "15:45" },
      { id: "c", occurrence_date: "2026-11-04", event_time: "09:00" },
    ];
    expect(nextUpEvent(events, at(9))?.id).toBe("b");
    expect(nextUpEvent(events, at(15, 45))?.id).toBe("b");
    expect(nextUpEvent(events, at(16))?.id).toBe("c");
    expect(nextUpEvent([], at(9))).toBeNull();
  });

  it("treats all-day events as still ahead today", () => {
    const events = [{ id: "x", occurrence_date: "2026-11-03", event_time: null }];
    expect(nextUpEvent(events, at(21))?.id).toBe("x");
  });
});

describe("time-aware schedule", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 3, h, m);
  const today = (time: string | null) => ({ occurrence_date: "2026-11-03", event_time: time });

  it("keeps an event current for an hour after it starts", () => {
    expect(eventPhase(today("19:30"), at(19, 0))).toBe("later");
    expect(eventPhase(today("19:30"), at(19, 30))).toBe("now");
    expect(eventPhase(today("19:30"), at(20, 29))).toBe("now");
    expect(eventPhase(today("19:30"), at(20, 30))).toBe("earlier");
    expect(eventPhase(today(null), at(23, 59))).toBe("now");
    expect(eventPhase({ occurrence_date: "2026-11-02", event_time: null }, at(9))).toBe("earlier");
    expect(eventPhase({ occurrence_date: "2026-11-04", event_time: "08:00" }, at(23))).toBe("later");
  });

  it("opens on tomorrow once today is over", () => {
    const day = [today("09:30"), today("17:15"), today("19:30")];
    expect(defaultScheduleDay(day, at(12))).toBe("today");
    expect(defaultScheduleDay(day, at(20, 0))).toBe("today");
    expect(defaultScheduleDay(day, at(20, 44))).toBe("tomorrow");
    expect(defaultScheduleDay([...day, today(null)], at(22))).toBe("today");
    expect(defaultScheduleDay([], at(9))).toBe("today");
    expect(defaultScheduleDay([], at(18))).toBe("tomorrow");
  });

  it("counts whole rows that fit", () => {
    expect(rowsThatFit(300, 56, 8)).toBe(4);
    expect(rowsThatFit(312, 56, 8)).toBe(5);
    expect(rowsThatFit(40, 56, 8)).toBe(0);
    expect(rowsThatFit(300, 0, 8)).toBe(0);
  });
});
