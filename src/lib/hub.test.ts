import { describe, expect, it } from "vitest";
import { addedLabel, dayPart, doneLabel, formatDuration, groceryIcon, nextEventLine, season } from "@/lib/hub";
import type { ExpandedCalendarEvent } from "@/lib/types";

const event = (over: Partial<ExpandedCalendarEvent>): ExpandedCalendarEvent => ({
  id: over.id ?? "e1",
  pin_code: "1234",
  event_date: over.occurrence_date ?? "2026-11-04",
  occurrence_date: "2026-11-04",
  event_time: null,
  title: "Thing",
  note: null,
  event_type: "event",
  color: "blue",
  is_done: false,
  recurrence: "none",
  recurrence_end: null,
  notify_before: -1,
  notify_channels: [],
  created_at: "2026-11-01T00:00:00Z",
  source_type: "manual",
  source_label: null,
  source_event_id: null,
  is_recurrence: false,
  ...over,
} as ExpandedCalendarEvent);

describe("season and day part", () => {
  it("uses southern-hemisphere seasons", () => {
    expect(season(new Date(2026, 10, 4))).toBe("Spring");
    expect(season(new Date(2026, 0, 4))).toBe("Summer");
    expect(season(new Date(2026, 3, 4))).toBe("Autumn");
    expect(season(new Date(2026, 6, 4))).toBe("Winter");
  });
  it("names the part of the day", () => {
    expect(dayPart(new Date(2026, 10, 4, 6))).toBe("dawn");
    expect(dayPart(new Date(2026, 10, 4, 9))).toBe("morning");
    expect(dayPart(new Date(2026, 10, 4, 16))).toBe("afternoon");
    expect(dayPart(new Date(2026, 10, 4, 19))).toBe("evening");
    expect(dayPart(new Date(2026, 10, 4, 23))).toBe("night");
  });
});

describe("nextEventLine", () => {
  const today = "2026-11-04";
  const tomorrow = "2026-11-05";
  const events = [
    event({ id: "a", title: "Swimming lesson", event_time: "09:30" }),
    event({ id: "b", title: "Bin night", event_time: "19:00" }),
    event({ id: "c", title: "All-day thing" }),
    event({ id: "d", title: "Dentist", event_time: "14:15", occurrence_date: tomorrow }),
  ];
  it("counts down to the next timed event today, with people", () => {
    const line = nextEventLine(events, today, tomorrow, 9 * 60 - 42 + 30, (e) => (e.id === "a" ? ["Nayla"] : []));
    expect(line.text).toBe("Swimming lesson in 42 minutes (Nayla)");
    expect(line.event?.id).toBe("a");
  });
  it("uses hours for longer waits and skips past events", () => {
    expect(nextEventLine(events, today, tomorrow, 16 * 60 + 45).text).toBe("Bin night in 2 h 15 min");
  });
  it("says when something is starting", () => {
    expect(nextEventLine(events, today, tomorrow, 19 * 60).text).toBe("Bin night is starting now");
  });
  it("ignores finished events", () => {
    const done = events.map((e) => (e.id === "b" ? { ...e, is_done: true } : e));
    expect(nextEventLine(done, today, tomorrow, 16 * 60).text).toBe("Nothing else today. Tomorrow: Dentist at 2:15 PM");
  });
  it("has a quiet fallback", () => {
    expect(nextEventLine([], today, tomorrow, 600)).toEqual({ event: null, text: "Nothing else planned today." });
  });
  it("formats durations", () => {
    expect(formatDuration(1)).toBe("in 1 minute");
    expect(formatDuration(60)).toBe("in 1 h");
  });
});

describe("item labels", () => {
  const now = new Date(2026, 10, 4, 16, 0);
  it("describes when an item was added", () => {
    expect(addedLabel(new Date(2026, 10, 4, 15, 59).toISOString(), now)).toBe("Added just now");
    expect(addedLabel(new Date(2026, 10, 4, 15, 20).toISOString(), now)).toBe("Added 40 min ago");
    expect(addedLabel(new Date(2026, 10, 4, 8, 0).toISOString(), now)).toBe("Added today");
    expect(addedLabel(new Date(2026, 10, 3, 8, 0).toISOString(), now)).toBe("Added yesterday");
    expect(addedLabel(new Date(2026, 10, 1, 8, 0).toISOString(), now)).toBe("Added 3 days ago");
  });
  it("describes when an item was done", () => {
    expect(doneLabel(new Date(2026, 10, 4, 6, 45).toISOString(), now)).toMatch(/^Done at 6:45/);
    expect(doneLabel(new Date(2026, 10, 3, 6, 45).toISOString(), now)).toBe("Done yesterday");
    expect(doneLabel(null, now)).toBe("Done");
  });
});

describe("groceryIcon", () => {
  it("matches common items", () => {
    expect(groceryIcon("Full cream milk")).toBe("milk");
    expect(groceryIcon("Eggs (dozen)")).toBe("egg");
    expect(groceryIcon("Sourdough loaf")).toBe("bread");
    expect(groceryIcon("Hass avocados & limes")).toBe("fruit");
    expect(groceryIcon("Spring onions")).toBe("veg");
    expect(groceryIcon("Nappies size 3")).toBe("baby");
    expect(groceryIcon("Basmati rice 5kg")).toBe("grain");
    expect(groceryIcon("Greek yoghurt")).toBe("milk");
    expect(groceryIcon("Chicken thighs")).toBe("chicken");
    expect(groceryIcon("Something odd")).toBe("basket");
  });
});
