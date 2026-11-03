import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  upsert: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/supabase", () => ({
  createSupabaseRouteClient: () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  createSupabaseServiceClient: mocks.admin,
}));
import { POST } from "./route";

const body = {
  pin: "1234",
  subscription: {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  },
};
const request = (data: unknown = body) =>
  new Request("https://home.example/api/push/subscribe", {
    method: "POST",
    headers: {
      origin: "https://home.example",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-a" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: "1234", error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ from: () => ({ upsert: mocks.upsert }) });
});
describe("push registration authorization", () => {
  it("rejects anonymous registration before accessing the service client", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects a different household", async () => {
    expect((await POST(request({ ...body, pin: "9999" }))).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects null input without crashing", async () =>
    expect((await POST(request(null))).status).toBe(400));
  it("writes the authenticated household scope using the existing payload", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        pin_code: "1234",
        endpoint: body.subscription.endpoint,
      }),
      { onConflict: "endpoint" },
    );
  });
});
