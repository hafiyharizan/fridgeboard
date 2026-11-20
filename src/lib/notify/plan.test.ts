import { describe, expect, it } from "vitest";
import { prayerSchedule } from "@/lib/prayer";
import type { CalendarEvent, HouseholdSettings } from "@/lib/types";
import {
  eventsStartingOn,
  nextTryAt,
  planAthanJobs,
  planDailyJobs,
  planEventJobs,
  zonedTimeToUtc,
} from "./plan";

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "ev1",
  pin_code: "1234",
  event_date: "2026-11-20",
  event_time: "09:30",
  title: "Dentist",
  note: null,
  event_type: "event",
  color: "amber",
  is_done: false,
  recurrence: "none",
  recurrence_end: null,
  end_date: null,
  notify_before: 15,
  notify_channels: [],
  created_at: "2026-11-01T00:00:00Z",
  source_type: "manual",
  source_label: null,
  source_event_id: null,
  ...over,
});

const perth = () => "Australia/Perth";
const at = (iso: string) => new Date(iso);

describe("zonedTimeToUtc", () => {
  it("converts household wall-clock time to UTC", () => {
    expect(zonedTimeToUtc("2026-11-20", "09:30", "Australia/Perth").toISOString()).toBe("2026-11-20T01:30:00.000Z");
    // Sydney is on daylight time (UTC+11) in November.
    expect(zonedTimeToUtc("2026-11-20", "09:30", "Australia/Sydney").toISOString()).toBe("2026-11-19T22:30:00.000Z");
    expect(zonedTimeToUtc("2026-07-20", "09:30", "Australia/Sydney").toISOString()).toBe("2026-07-19T23:30:00.000Z");
  });
});

describe("planEventJobs", () => {
  it("is due from the reminder time for 30 minutes", () => {
    // 09:30 Perth, 15 min before = 09:15 Perth = 01:15Z
    expect(planEventJobs([event()], perth, at("2026-11-20T01:14:00Z"))).toEqual([]);
    const [job] = planEventJobs([event()], perth, at("2026-11-20T01:15:00Z"));
    expect(job).toMatchObject({
      job_key: "event:ev1:2026-11-20:09:30:15",
      kind: "event",
      pin_code: "1234",
      due_at: "2026-11-20T01:15:00.000Z",
      expires_at: "2026-11-20T01:45:00.000Z",
      payload: { event_id: "ev1", occurrence_date: "2026-11-20", event_time: "09:30", notify_before: "15" },
    });
    expect(planEventJobs([event()], perth, at("2026-11-20T01:44:00Z"))).toHaveLength(1);
    expect(planEventJobs([event()], perth, at("2026-11-20T01:45:00Z"))).toEqual([]);
  });

  it("reminds on every occurrence of a recurring event, not just the first", () => {
    const weekly = event({ event_date: "2026-10-02", recurrence: "weekly" }); // Fridays
    const [job] = planEventJobs([weekly], perth, at("2026-11-20T01:20:00Z")); // Fri 20 Nov
    expect(job.job_key).toBe("event:ev1:2026-11-20:09:30:15");
    expect(planEventJobs([weekly], perth, at("2026-11-19T01:20:00Z"))).toEqual([]); // Thursday
  });

  it("stops after the recurrence ends", () => {
    const ended = event({ event_date: "2026-10-02", recurrence: "weekly", recurrence_end: "2026-11-13" });
    expect(planEventJobs([ended], perth, at("2026-11-20T01:20:00Z"))).toEqual([]);
  });

  it("handles a reminder the evening before a just-after-midnight event", () => {
    const late = event({ event_date: "2026-11-21", event_time: "00:30", notify_before: 60 });
    // 23:30 Perth on the 20th = 15:30Z
    const [job] = planEventJobs([late], perth, at("2026-11-20T15:31:00Z"));
    expect(job).toMatchObject({ due_at: "2026-11-20T15:30:00.000Z", payload: { occurrence_date: "2026-11-21" } });
  });

  it("catches up a late-night reminder after midnight", () => {
    const late = event({ event_time: "23:50", notify_before: 0 });
    // 00:10 Perth on the 21st = 16:10Z on the 20th
    expect(planEventJobs([late], perth, at("2026-11-20T16:10:00Z"))).toHaveLength(1);
  });

  it("uses each household's own timezone", () => {
    const zoneFor = (pin: string) => (pin === "9999" ? "Australia/Sydney" : "Australia/Perth");
    const sydney = event({ pin_code: "9999" });
    // 09:15 Sydney = 22:15Z the day before
    expect(planEventJobs([sydney], zoneFor, at("2026-11-19T22:16:00Z"))).toHaveLength(1);
    expect(planEventJobs([sydney], zoneFor, at("2026-11-20T01:16:00Z"))).toEqual([]);
  });

  it("reminds a multi-day event on its first day only", () => {
    const trip = event({ event_date: "2026-11-19", end_date: "2026-11-21" });
    expect(planEventJobs([trip], perth, at("2026-11-19T01:20:00Z"))).toHaveLength(1);
    expect(planEventJobs([trip], perth, at("2026-11-20T01:20:00Z"))).toEqual([]);
  });

  it("skips all-day events, no-reminder events and finished one-offs", () => {
    const now = at("2026-11-20T01:20:00Z");
    expect(planEventJobs([event({ event_time: null })], perth, now)).toEqual([]);
    expect(planEventJobs([event({ notify_before: -1 })], perth, now)).toEqual([]);
    expect(planEventJobs([event({ is_done: true })], perth, now)).toEqual([]);
  });

  it("accepts HH:MM:SS times and gives edits a new key", () => {
    const [a] = planEventJobs([event({ event_time: "09:30:00" })], perth, at("2026-11-20T01:20:00Z"));
    const [b] = planEventJobs([event({ event_time: "09:35" })], perth, at("2026-11-20T01:20:00Z"));
    expect(a.job_key).toBe("event:ev1:2026-11-20:09:30:15");
    expect(b.job_key).toBe("event:ev1:2026-11-20:09:35:15");
  });
});

describe("planAthanJobs", () => {
  const home: HouseholdSettings = {
    pin_code: "1234",
    location_name: "Perth, Western Australia, Australia",
    latitude: -31.9523,
    longitude: 115.8613,
    timezone: "Australia/Perth",
    prayer_enabled: true,
    prayer_method: "MuslimWorldLeague",
    prayer_madhab: "shafi",
    athan_enabled: true,
    updated_at: "2026-11-01T00:00:00Z",
  };
  const asr = prayerSchedule(home.latitude!, home.longitude!, { year: 2026, month: 11, day: 3 }, "MuslimWorldLeague")[2].time;

  it("queues the athan when a prayer time arrives", () => {
    const [job] = planAthanJobs([home], new Date(asr.getTime() + 60_000));
    expect(job).toMatchObject({
      job_key: "athan:1234:2026-11-03:asr",
      kind: "athan",
      due_at: asr.toISOString(),
      payload: { prayer: "asr", label: "Asr", date: "2026-11-03", place: "Perth" },
    });
  });

  it("does nothing between prayers or with alerts off", () => {
    expect(planAthanJobs([home], new Date(asr.getTime() + 60 * 60_000))).toEqual([]);
    expect(planAthanJobs([{ ...home, athan_enabled: false }], new Date(asr.getTime() + 60_000))).toEqual([]);
    expect(planAthanJobs([{ ...home, latitude: null }], new Date(asr.getTime() + 60_000))).toEqual([]);
  });
});

describe("planDailyJobs", () => {
  it("queues the summary at 07:00 and groceries at 08:00 household time", () => {
    // 07:00 Perth on the 20th = 23:00Z on the 19th
    expect(planDailyJobs(["1234"], perth, at("2026-11-19T22:59:00Z"))).toEqual([]);
    expect(planDailyJobs(["1234"], perth, at("2026-11-19T23:00:00Z")).map((j) => j.job_key)).toEqual([
      "summary:1234:2026-11-20",
    ]);
    expect(planDailyJobs(["1234"], perth, at("2026-11-20T00:30:00Z")).map((j) => j.job_key)).toEqual([
      "summary:1234:2026-11-20",
      "grocery:1234:2026-11-20",
    ]);
    // 09:00 Perth: the summary's two-hour window has closed
    expect(planDailyJobs(["1234"], perth, at("2026-11-20T01:00:00Z")).map((j) => j.kind)).toEqual(["grocery"]);
  });
});

describe("eventsStartingOn", () => {
  it("counts recurring occurrences and first days only", () => {
    const events = [
      event({ id: "weekly", event_date: "2026-10-02", recurrence: "weekly" }),
      event({ id: "trip", event_date: "2026-11-19", end_date: "2026-11-21" }),
      event({ id: "done", is_done: true }),
      event({ id: "today" }),
    ];
    expect(eventsStartingOn(events, "2026-11-20").map((e) => e.id)).toEqual(["weekly", "today"]);
  });
});

describe("nextTryAt", () => {
  it("backs off a minute per attempt, up to five", () => {
    const now = at("2026-11-20T00:00:00Z");
    expect(nextTryAt(1, now).toISOString()).toBe("2026-11-20T00:01:00.000Z");
    expect(nextTryAt(3, now).toISOString()).toBe("2026-11-20T00:03:00.000Z");
    expect(nextTryAt(9, now).toISOString()).toBe("2026-11-20T00:05:00.000Z");
  });
});
