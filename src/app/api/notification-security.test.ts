import { afterEach, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({ createSupabaseServiceClient: admin }));
vi.mock("@/lib/push", () => ({ sendPushToPin: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("notification jobs fail closed", () => {
  for (const configured of [false, true]) {
    it(`rejects unauthorized calls with CRON_SECRET ${configured ? "set" : "missing"}`, async () => {
      vi.resetModules();
      vi.stubEnv("CRON_SECRET", configured ? "test-secret" : "");
      const tick = await import("./cron/tick/route");
      const reminders = await import("./push/remind/route");
      const request = new Request("https://home.example/api/cron/tick", { method: "POST" });
      expect((await tick.POST(request)).status).toBe(401);
      expect((await reminders.POST(request)).status).toBe(401);
      expect(admin).not.toHaveBeenCalled();
    });
  }
});
