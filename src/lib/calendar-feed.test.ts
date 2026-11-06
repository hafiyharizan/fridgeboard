import { describe, expect, it } from "vitest";
import { buildCalendarFeed } from "@/lib/calendar-feed";
import type { CalendarEvent } from "@/lib/types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    pin_code: "1234",
    event_date: "2026-03-15",
    event_time: null,
    title: "Family dinner",
    note: "Bring dessert",
    event_type: "event",
    color: "amber",
    is_done: false,
    recurrence: "none",
    recurrence_end: null,
    end_date: null,
    notify_before: -1,
    notify_channels: [],
    created_at: "2026-01-01T00:00:00.000Z",
    source_type: "manual",
    source_label: null,
    source_event_id: null,
    ...overrides,
  };
}

describe("buildCalendarFeed", () => {
  it("can't be broken into extra properties by line breaks in a title", () => {
    const feed = buildCalendarFeed([makeEvent({ title: "Dinner\rATTENDEE:mailto:x@evil.test\nX-Y:z" })]);
    const lines = feed.split("\r\n");
    expect(lines.some((line) => line.startsWith("ATTENDEE"))).toBe(false);
    expect(lines.some((line) => line.startsWith("X-Y"))).toBe(false);
    expect(feed).not.toMatch(/\r(?!\n)/);
  });

  it("renders a valid all-day VEVENT", () => {
    const feed = buildCalendarFeed([makeEvent()]);

    expect(feed).toContain("BEGIN:VCALENDAR");
    expect(feed).toContain("SUMMARY:Family dinner");
    expect(feed).toContain("DTSTART;VALUE=DATE:20260315");
    expect(feed).toContain("DTEND;VALUE=DATE:20260316");
    expect(feed).toContain("DESCRIPTION:Bring dessert");
  });

  it("includes recurrence rules when an event repeats", () => {
    const feed = buildCalendarFeed([
      makeEvent({
        recurrence: "weekly",
        recurrence_end: "2026-04-30",
      }),
    ]);

    expect(feed).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260430T235959Z");
  });

  it("adds imported source details to the description", () => {
    const feed = buildCalendarFeed([
      makeEvent({
        title: "Hari Raya Aidilfitri",
        source_type: "islamic",
        source_label: "Islamic events",
        source_event_id: "2026-aidilfitri",
      }),
    ]);

    expect(feed).toContain("Imported from Islamic events");
    expect(feed).toContain("CATEGORIES:event,Islamic events");
  });

  it("ends a multi-day event after its last day (exclusive DTEND)", () => {
    const ics = buildCalendarFeed([makeEvent({ event_date: "2026-11-13", end_date: "2026-11-16" })]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261113");
    expect(ics).toContain("DTEND;VALUE=DATE:20261117");
  });

  it("keeps a single-day event to one day", () => {
    const ics = buildCalendarFeed([makeEvent({ event_date: "2026-11-13", end_date: null })]);
    expect(ics).toContain("DTEND;VALUE=DATE:20261114");
  });
});
