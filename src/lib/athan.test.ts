import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runAthan } from "@/lib/athan";
import { prayerSchedule } from "@/lib/prayer";
import type { Database } from "@/lib/types";

const mocks = vi.hoisted(() => ({ rows: vi.fn(), claim: vi.fn(), send: vi.fn(), upsert: vi.fn(), prune: vi.fn() }));
vi.mock("@/lib/push", () => ({ sendPushToPin: mocks.send }));

/** A query chain that resolves to `result` whatever filters are applied. */
function chain(result: () => unknown) {
  const query = {
    eq: () => query,
    not: () => query,
    lt: () => query,
    then: (resolve: (value: unknown) => void) => resolve(result()),
  };
  return query;
}

const fake = {
  from: (table: string) => {
    if (table === "prayer_push_log") return { insert: mocks.claim };
    if (table === "prayer_times") return { upsert: mocks.upsert, delete: () => chain(mocks.prune) };
    return { select: () => chain(mocks.rows) };
  },
};
// The fake implements only the calls runAthan makes.
const supabase = fake as unknown as SupabaseClient<Database>;

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
const at = (ms: number) => new Date(asr.getTime() + ms);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.mockReturnValue({ data: [home], error: null });
  mocks.claim.mockResolvedValue({ error: null });
  mocks.send.mockResolvedValue(2);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.prune.mockReturnValue({ error: null });
});

describe("runAthan", () => {
  it("sends when a prayer time arrives, once", async () => {
    expect(await runAthan(supabase, at(60_000))).toMatchObject({ sent: 2, due: 1, households: 1 });
    expect(mocks.claim).toHaveBeenCalledWith({ pin_code: "1234", prayer: "asr", prayer_date: "2026-11-03" });
    expect(mocks.send).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({ title: "Time for Asr", tag: "athan-asr-2026-11-03" }),
      expect.anything(),
    );
  });

  it("skips a prayer already announced", async () => {
    mocks.claim.mockResolvedValue({ error: { code: "23505" } });
    expect(await runAthan(supabase, at(60_000))).toMatchObject({ sent: 0, due: 1 });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does nothing between prayers", async () => {
    expect(await runAthan(supabase, at(60 * 60_000))).toMatchObject({ sent: 0, due: 0 });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("saves today's and tomorrow's prayer times for the database check", async () => {
    expect(await runAthan(supabase, at(60 * 60_000))).toMatchObject({ timesSaved: 10 });
    const [rows, options] = mocks.upsert.mock.calls[0];
    expect(options).toEqual({ onConflict: "pin_code,prayer,prayer_date" });
    expect(rows).toContainEqual({
      pin_code: "1234",
      prayer: "asr",
      prayer_date: "2026-11-03",
      prayer_at: asr.toISOString(),
    });
    expect(rows.filter((row: { prayer_date: string }) => row.prayer_date === "2026-11-04")).toHaveLength(5);
  });
});
