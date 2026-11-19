import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const admin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-admin", () => ({ createSupabaseServiceClient: admin }));
vi.mock("@/lib/push", () => ({ sendPush: vi.fn(), sendPushToPin: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("the notification cron fails closed", () => {
  for (const configured of [false, true]) {
    it(`rejects unauthorized calls with CRON_SECRET ${configured ? "set" : "missing"}`, async () => {
      vi.resetModules();
      vi.stubEnv("CRON_SECRET", configured ? "test-secret" : "");
      const tick = await import("./cron/tick/route");
      for (const authorization of [null, "Bearer wrong", "test-secret"]) {
        const headers: Record<string, string> = authorization ? { authorization } : {};
        const request = new Request("https://home.example/api/cron/tick", { method: "POST", headers });
        expect((await tick.POST(request)).status).toBe(401);
      }
      expect(admin).not.toHaveBeenCalled();
    });
  }
});
