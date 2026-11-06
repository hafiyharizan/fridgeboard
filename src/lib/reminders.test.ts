import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDueReminders } from "@/lib/reminders";
import type { Database } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  events: vi.fn(),
  logs: vi.fn(),
  channels: vi.fn(),
  logInsert: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/lib/push", () => ({ sendPushToPin: mocks.send }));

/** A query chain that resolves to `result` whatever filters are applied. */
function chain(result: () => unknown) {
  const query = {
    eq: () => query,
    not: () => query,
    gte: () => query,
    lte: () => query,
    in: () => query,
    then: (resolve: (value: unknown) => void) => resolve(result()),
  };
  return query;
}

const fake = {
  from: (table: string) => {
    switch (table) {
      case "calendar_events":
        return { select: () => chain(mocks.events) };
      case "household_settings":
        return { select: () => chain(() => ({ data: [{ pin_code: "1234", timezone: "Australia/Perth" }] })) };
      case "notification_log":
        return { select: () => chain(mocks.logs), insert: mocks.logInsert };
      default:
        return { select: () => chain(mocks.channels) };
    }
  },
};
// The fake implements only the calls sendDueReminders makes.
const supabase = fake as unknown as SupabaseClient<Database>;

// Dentist at 09:30 Perth with a 15-minute reminder: due from 01:15 UTC.
const event = {
  id: "event-1",
  pin_code: "1234",
  event_date: "2026-11-03",
  event_time: "09:30",
  title: "Dentist",
  note: null,
  event_type: "event",
  notify_channels: [],
  notify_before: 15,
};
const dueTime = new Date("2026-11-03T01:16:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events.mockReturnValue({ data: [event], error: null });
  mocks.logs.mockReturnValue({ data: [] });
  mocks.channels.mockReturnValue({ data: [] });
  mocks.logInsert.mockResolvedValue({ error: null });
  mocks.send.mockResolvedValue(3);
});

describe("sendDueReminders", () => {
  it("pushes a due reminder even with no extra channels", async () => {
    expect(await sendDueReminders(supabase, dueTime)).toEqual({ due: 1, sent: 3 });
    expect(mocks.logInsert).toHaveBeenCalledWith({ event_id: "event-1", channel_type: "push", status: "sent" });
    expect(mocks.send).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({ title: "Dentist", tag: "calendar-event-1" }),
      expect.anything(),
    );
  });

  it("doesn't push twice", async () => {
    mocks.logs.mockReturnValue({ data: [{ event_id: "event-1", channel_type: "push" }] });
    expect(await sendDueReminders(supabase, dueTime)).toEqual({ due: 1, sent: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("leaves the push to the run that claimed it", async () => {
    mocks.logInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    expect(await sendDueReminders(supabase, dueTime)).toEqual({ due: 1, sent: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("waits until the trigger time and stops after the catch-up window", async () => {
    expect(await sendDueReminders(supabase, new Date("2026-11-03T01:14:00Z"))).toEqual({ due: 0, sent: 0 });
    expect(await sendDueReminders(supabase, new Date("2026-11-03T01:46:00Z"))).toEqual({ due: 0, sent: 0 });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
