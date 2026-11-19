import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationJob } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  sendPush: vi.fn(),
  sendTelegram: vi.fn(),
  event: vi.fn(),
  channels: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/push", () => ({ sendPush: mocks.sendPush }));
vi.mock("./channels", () => ({
  sendEmail: vi.fn(),
  sendWebhook: vi.fn(),
  sendTelegram: mocks.sendTelegram,
}));

import { deliverJob } from "./queue";

/** A chainable stand-in for the Supabase query builder. */
function fakeDb() {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "or", "not", "gte", "limit"]) chain[method] = () => chain;
      chain.maybeSingle = () => Promise.resolve(mocks.event());
      chain.update = (values: Record<string, unknown>) => {
        mocks.updates.push(values);
        return { eq: () => Promise.resolve({ error: null }) };
      };
      chain.then = (resolve: (value: unknown) => void) =>
        resolve(table === "notification_channels" ? mocks.channels() : { data: [], error: null });
      return chain;
    },
  };
}

const now = new Date("2026-11-20T01:16:00Z");
const job = (over: Partial<NotificationJob> = {}): NotificationJob => ({
  id: "job1",
  job_key: "athan:1234:2026-11-20:asr",
  kind: "athan",
  pin_code: "1234",
  due_at: "2026-11-20T01:15:00Z",
  expires_at: "2026-11-20T01:25:00Z",
  payload: { prayer: "asr", label: "Asr", date: "2026-11-20", time: "3:40 pm", place: "Perth" },
  status: "sending",
  attempts: 1,
  next_try_at: "2026-11-20T01:15:00Z",
  locked_until: null,
  done_targets: [],
  last_error: null,
  sent_at: null,
  created_at: "2026-11-20T01:15:00Z",
  ...over,
});

const eventJob = (over: Partial<NotificationJob> = {}) =>
  job({
    kind: "event",
    job_key: "event:ev1:2026-11-20:09:30:15",
    expires_at: "2026-11-20T01:45:00Z",
    payload: { event_id: "ev1", occurrence_date: "2026-11-20", event_time: "09:30", notify_before: "15" },
    ...over,
  });

const storedEvent = {
  id: "ev1",
  title: "Dentist",
  note: null,
  event_type: "event",
  event_date: "2026-11-20",
  event_time: "09:30:00",
  is_done: false,
  recurrence: "none",
  notify_before: 15,
  notify_channels: ["telegram"],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the typed client
const deliver = (j: NotificationJob) => deliverJob(fakeDb() as any, j, now);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
  mocks.sendPush.mockResolvedValue({ devices: 2, sent: 2, failed: 0, configured: true });
  mocks.sendTelegram.mockResolvedValue(null);
  mocks.event.mockReturnValue({ data: storedEvent, error: null });
  mocks.channels.mockReturnValue({
    data: [{ id: "tg1", channel_type: "telegram", channel_value: "42" }],
    error: null,
  });
});

describe("deliverJob", () => {
  it("sends an athan push that expires with the window and wakes the phone", async () => {
    expect(await deliver(job())).toBe("sent");
    expect(mocks.sendPush).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({ title: "Time for Asr", body: "Asr · 3:40 pm in Perth", tag: "athan-asr-2026-11-20" }),
      expect.anything(),
      { ttlSeconds: 540, urgency: "high" },
    );
    expect(mocks.updates[0]).toMatchObject({ status: "sent", done_targets: ["push"], locked_until: null });
  });

  it("retries a push that failed on every device", async () => {
    mocks.sendPush.mockResolvedValue({ devices: 1, sent: 0, failed: 1, configured: true });
    expect(await deliver(job())).toBe("retrying");
    expect(mocks.updates[0]).toMatchObject({ status: "pending", next_try_at: "2026-11-20T01:17:00.000Z", done_targets: [] });
  });

  it("gives up after the last attempt", async () => {
    mocks.sendPush.mockResolvedValue({ devices: 1, sent: 0, failed: 1, configured: true });
    expect(await deliver(job({ attempts: 5 }))).toBe("failed");
  });

  it("skips quietly when the household has no devices", async () => {
    mocks.sendPush.mockResolvedValue({ devices: 0, sent: 0, failed: 0, configured: true });
    expect(await deliver(job())).toBe("skipped");
    expect(mocks.updates[0]).toMatchObject({ status: "skipped", last_error: "nobody to notify" });
  });

  it("pushes an event reminder even with no other channels set up", async () => {
    mocks.event.mockReturnValue({ data: { ...storedEvent, notify_channels: [] }, error: null });
    expect(await deliver(eventJob())).toBe("sent");
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegram).not.toHaveBeenCalled();
  });

  it("retries only the channel that failed, never re-sending the push", async () => {
    mocks.sendTelegram.mockResolvedValueOnce({ reason: "telegram HTTP 502", retry: true });
    expect(await deliver(eventJob())).toBe("retrying");
    expect(mocks.updates[0]).toMatchObject({ status: "pending", done_targets: ["push"] });

    expect(await deliver(eventJob({ attempts: 2, done_targets: ["push"] }))).toBe("sent");
    expect(mocks.sendPush).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegram).toHaveBeenCalledTimes(2);
    expect(mocks.sendTelegram).toHaveBeenLastCalledWith("42", expect.not.stringContaining("*"));
    expect(mocks.updates[1]).toMatchObject({ status: "sent", done_targets: ["push", "telegram:tg1"] });
  });

  it("does not retry a channel that can't succeed", async () => {
    mocks.sendTelegram.mockResolvedValue({ reason: "telegram HTTP 400", retry: false });
    expect(await deliver(eventJob())).toBe("sent");
    expect(mocks.updates[0]).toMatchObject({ status: "sent", last_error: "telegram HTTP 400" });
  });

  it("skips a reminder whose event was deleted or edited", async () => {
    mocks.event.mockReturnValue({ data: null, error: null });
    expect(await deliver(eventJob())).toBe("skipped");
    mocks.event.mockReturnValue({ data: { ...storedEvent, event_time: "10:00" }, error: null });
    expect(await deliver(eventJob())).toBe("skipped");
    expect(mocks.sendPush).not.toHaveBeenCalled();
    expect(mocks.updates.map((u) => u.last_error)).toEqual(["event deleted", "event changed"]);
  });
});
