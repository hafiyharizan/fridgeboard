import { describe, expect, it } from "vitest";
import { pendingItems, upcomingEvents, weekDates } from "./dashboard";
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
