import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- mocks ----------------------------------------------------------------

const mockSendPushToPin = vi.fn();
vi.mock("@/lib/push", () => ({
  sendPushToPin: mockSendPushToPin,
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServiceClient: vi.fn().mockReturnValue({}),
}));

// ---- helpers ---------------------------------------------------------------

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/push/new-item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---- tests -----------------------------------------------------------------

describe("POST /api/push/new-item", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when pin is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ listName: "Grocery", itemText: "Milk" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing/i);
  });

  it("returns 400 when listName is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ pin: "1234", itemText: "Milk" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when itemText is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ pin: "1234", listName: "Grocery" }));
    expect(res.status).toBe(400);
  });

  it("calls sendPushToPin with correct payload and returns sent count", async () => {
    mockSendPushToPin.mockResolvedValueOnce(2);
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ pin: "1234", listName: "Grocery", itemText: "Eggs" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(2);

    expect(mockSendPushToPin).toHaveBeenCalledOnce();
    const [pinArg, payloadArg] = mockSendPushToPin.mock.calls[0] as [string, { title: string; body: string; url: string }];
    expect(pinArg).toBe("1234");
    expect(payloadArg.title).toContain("Grocery");
    expect(payloadArg.body).toBe("Eggs");
    expect(payloadArg.url).toBe("/list");
  });

  it("returns sent: 0 when no subscribers exist", async () => {
    mockSendPushToPin.mockResolvedValueOnce(0);
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ pin: "0000", listName: "To-Do", itemText: "Call plumber" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(0);
  });
});
