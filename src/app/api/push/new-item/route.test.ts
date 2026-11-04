import { beforeEach, describe, expect, it, vi } from "vitest";

const ITEM_ID = "3f0c6b0e-4a1d-4d1f-9a43-2b7e5f0d9c11";
const LIST_ID = "8b2d6a77-1c4e-4a3b-8f5d-6e9a0c1b2d3e";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  item: vi.fn(),
  list: vi.fn(),
  profile: vi.fn(),
  claim: vi.fn(),
  admin: vi.fn(),
  send: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));

// Minimal chain: .from(table).select().eq().maybeSingle()
const reader = (table: string) => ({
  select: () => ({
    eq: () => ({
      maybeSingle: () =>
        table === "items" ? mocks.item() : table === "lists" ? mocks.list() : mocks.profile(),
    }),
  }),
});

vi.mock("@/lib/supabase", () => ({
  createSupabaseRouteClient: () => ({
    auth: { getUser: mocks.getUser },
    from: reader,
  }),
}));
vi.mock("@/lib/supabase-admin", () => ({ createSupabaseServiceClient: mocks.admin }));
vi.mock("@/lib/push", () => ({ sendPushToPin: mocks.send }));

import { POST } from "./route";

const request = (data: unknown = { itemId: ITEM_ID }, origin = "https://home.example") =>
  new Request("https://home.example/api/push/new-item", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(data),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "user-a", email: "a@example.com", user_metadata: {} } },
    error: null,
  });
  mocks.item.mockResolvedValue({
    data: {
      id: ITEM_ID,
      list_id: LIST_ID,
      text: "Oat milk",
      created_by: "user-a",
      created_at: new Date().toISOString(),
    },
  });
  mocks.list.mockResolvedValue({ data: { name: "Grocery", pin_code: "1234" } });
  mocks.profile.mockResolvedValue({ data: { display_name: "Alex Tan" } });
  mocks.claim.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({
    from: (table: string) =>
      table === "item_push_log" ? { insert: mocks.claim } : reader(table),
  });
  mocks.send.mockResolvedValue(2);
});

describe("new item push", () => {
  it("credits the member picked on a shared tablet and skips their devices", async () => {
    mocks.item.mockResolvedValue({
      data: {
        id: ITEM_ID,
        list_id: LIST_ID,
        text: "Bread",
        created_by: "user-a",
        added_by: "user-c",
        created_at: new Date().toISOString(),
      },
    });
    mocks.profile.mockResolvedValue({ data: { display_name: "Sarah Lee" } });
    await POST(request());
    expect(mocks.send).toHaveBeenCalledWith(
      "1234",
      expect.objectContaining({ body: "Sarah added Bread" }),
      expect.anything(),
      { excludeUserId: "user-c" },
    );
  });

  it("rejects cross-site requests", async () => {
    expect((await POST(request(undefined, "https://evil.example"))).status).toBe(403);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("rejects a malformed item id", async () => {
    expect((await POST(request({ itemId: "1; drop table" }))).status).toBe(400);
  });

  it("refuses items outside the household (hidden by RLS)", async () => {
    mocks.item.mockResolvedValue({ data: null });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("only lets the member who added the item announce it", async () => {
    mocks.item.mockResolvedValue({
      data: { id: ITEM_ID, list_id: LIST_ID, text: "x", created_by: "user-b", created_at: new Date().toISOString() },
    });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("skips old items", async () => {
    mocks.item.mockResolvedValue({
      data: { id: ITEM_ID, list_id: LIST_ID, text: "x", created_by: "user-a", created_at: "2020-01-01T00:00:00Z" },
    });
    const res = await POST(request());
    expect(await res.json()).toEqual({ sent: 0, skipped: "stale" });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("sends at most once per item", async () => {
    mocks.claim.mockResolvedValue({ error: { code: "23505" } });
    const res = await POST(request());
    expect(await res.json()).toEqual({ sent: 0, skipped: "duplicate" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("notifies the household from server data, skipping the adder's devices", async () => {
    const res = await POST(request());
    expect(await res.json()).toEqual({ sent: 2 });
    expect(mocks.claim).toHaveBeenCalledWith({ item_id: ITEM_ID });
    expect(mocks.send).toHaveBeenCalledWith(
      "1234",
      {
        title: "Grocery",
        body: "Alex added Oat milk",
        tag: `new-item-${LIST_ID}`,
        url: "/list",
      },
      expect.anything(),
      { excludeUserId: "user-a" },
    );
  });
});
