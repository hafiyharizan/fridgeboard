import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prayerSchedule } from "@/lib/prayer";

const mocks = vi.hoisted(() => ({ rows: vi.fn(), claim: vi.fn(), send: vi.fn() }));

vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseServiceClient: () => ({
    from: (table: string) =>
      table === "prayer_push_log"
        ? { insert: mocks.claim }
        : {
            select: () => {
              const chain = { eq: () => chain, not: () => chain, then: (resolve: (v: unknown) => void) => resolve(mocks.rows()) };
              return chain;
            },
          },
  }),
}));
vi.mock("@/lib/push", () => ({ sendPushToPin: mocks.send }));

import { POST } from "./route";

const home = {
  pin_code: "1234",
  location_name: "Perth, Western Australia, Australia",
  latitude: -31.9523,
  longitude: 115.8613,
  timezone: "Australia/Perth",
  prayer_enabled: true,
  prayer_method: "MuslimWorldLeague",
  prayer_madhab: "shafi",
  athan_enabled: true,
};
const asr = prayerSchedule(home.latitude, home.longitude, { year: 2026, month: 11, day: 3 }, "MuslimWorldLeague")[2].time;
const call = (auth = "Bearer test-secret") =>
  POST(new Request("https://home.example/api/push/prayer", { method: "POST", headers: { authorization: auth } }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.clearAllMocks();
  mocks.rows.mockReturnValue({ data: [home], error: null });
  mocks.claim.mockResolvedValue({ error: null });
  mocks.send.mockResolvedValue(2);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("athan push", () => {
  it("rejects calls without the cron secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends when a prayer time arrives, once", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(asr.getTime() + 60_000));
    expect(await (await call()).json()).toEqual({ sent: 2, due: 1, households: 1 });
    expect(mocks.claim).toHaveBeenCalledWith({ pin_code: "1234", prayer: "asr", prayer_date: "2026-11-03" });
    expect(mocks.send).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({ title: "Time for Asr", tag: "athan-asr-2026-11-03" }),
      expect.anything(),
    );
  });

  it("skips a prayer already announced", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(asr.getTime() + 60_000));
    mocks.claim.mockResolvedValue({ error: { code: "23505" } });
    expect(await (await call()).json()).toMatchObject({ sent: 0, due: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does nothing between prayers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(asr.getTime() + 60 * 60_000));
    expect(await (await call()).json()).toMatchObject({ sent: 0, due: 0 });
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
