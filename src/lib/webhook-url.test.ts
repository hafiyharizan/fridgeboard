import { describe, expect, it } from "vitest";
import { isAllowedWebhookUrl } from "@/lib/webhook-url";

describe("isAllowedWebhookUrl", () => {
  it("allows public https URLs", () => {
    expect(isAllowedWebhookUrl("https://hooks.example.com/abc?x=1")).toBe(true);
    expect(isAllowedWebhookUrl("https://8.8.8.8/hook")).toBe(true);
  });

  it("rejects non-https and malformed URLs", () => {
    expect(isAllowedWebhookUrl("http://hooks.example.com")).toBe(false);
    expect(isAllowedWebhookUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedWebhookUrl("not a url")).toBe(false);
    expect(isAllowedWebhookUrl("https://user:pw@example.com")).toBe(false);
  });

  it("rejects local and private hosts", () => {
    for (const url of [
      "https://localhost/x",
      "https://app.localhost/x",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://172.20.0.1/x",
      "https://192.168.1.10/x",
      "https://169.254.169.254/latest/meta-data",
      "https://100.100.1.1/x",
      "https://[::1]/x",
      "https://[fd00::1]/x",
      "https://[::ffff:127.0.0.1]/x",
      "https://metadata.google.internal/x",
    ]) {
      expect(isAllowedWebhookUrl(url), url).toBe(false);
    }
  });
});
