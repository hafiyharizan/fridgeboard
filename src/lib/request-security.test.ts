import { describe, expect, it } from "vitest";
import { isPushSubscription, isSameOriginRequest } from "./request-security";

describe("request security", () => {
  it("rejects cross-origin browser mutations", () => {
    expect(
      isSameOriginRequest(
        new Request("https://home.example/api/calendar/sync", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        new Request("https://home.example/api/calendar/sync", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOriginRequest(
        new Request("https://home.example/api/calendar/sync", {
          headers: { origin: "https://home.example" },
        }),
      ),
    ).toBe(true);
  });
  const subscription = (endpoint: string) => ({
    endpoint,
    keys: { p256dh: "A".repeat(87), auth: "B".repeat(22) },
  });
  it("accepts supported browser push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/test",
      "https://updates.push.services.mozilla.com/wpush/v2/test",
      "https://web.push.apple.com/test",
      "https://wns2.notify.windows.com/test",
    ])
      expect(isPushSubscription(subscription(url))).toBe(true);
  });
  it("rejects private, insecure, credentialed and lookalike endpoints", () => {
    for (const url of [
      "http://fcm.googleapis.com/test",
      "https://127.0.0.1/test",
      "https://169.254.169.254/",
      "https://fcm.googleapis.com.evil.example/test",
      "https://user:pass@fcm.googleapis.com/test",
      "https://fcm.googleapis.com:8443/test",
    ])
      expect(isPushSubscription(subscription(url))).toBe(false);
  });
  it("rejects malformed subscription data", () => {
    for (const value of [
      null,
      [],
      {},
      { endpoint: "https://fcm.googleapis.com/test", keys: {} },
      {
        ...subscription("https://fcm.googleapis.com/test"),
        keys: { p256dh: "bad", auth: "bad" },
      },
    ])
      expect(isPushSubscription(value)).toBe(false);
  });
});
