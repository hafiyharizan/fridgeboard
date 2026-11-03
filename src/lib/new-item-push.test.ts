import { describe, expect, it } from "vitest";
import { buildNewItemPush, isRecentItem, NEW_ITEM_PUSH_WINDOW_MS, shortName } from "@/lib/new-item-push";
import { INSTALL_SNOOZE_MS, isAppleMobile, isInstallPromptHidden } from "@/lib/install-prompt";

describe("shortName", () => {
  it("uses the first name", () => expect(shortName("Alex Tan")).toBe("Alex"));
  it("uses the part before @ for emails", () => expect(shortName("sam@example.com")).toBe("sam"));
  it("falls back for blanks", () => expect(shortName("  ")).toBe("Someone"));
});

describe("buildNewItemPush", () => {
  it("tags by list so bursts replace each other", () => {
    const payload = buildNewItemPush({ adderName: "Alex", itemText: "Eggs", listId: "L1", listName: "Grocery" });
    expect(payload).toEqual({ title: "Grocery", body: "Alex added Eggs", tag: "new-item-L1", url: "/list" });
  });

  it("flattens whitespace and clips long text", () => {
    const { body } = buildNewItemPush({ adderName: "A", itemText: `a\n\nb ${"x".repeat(300)}`, listId: "L", listName: "L" });
    expect(body.startsWith("A added a b x")).toBe(true);
    expect(body.length).toBeLessThanOrEqual("A added ".length + 120);
    expect(body.endsWith("…")).toBe(true);
  });
});

describe("isRecentItem", () => {
  const now = new Date("2026-11-03T10:00:00Z");
  it("accepts items inside the window", () =>
    expect(isRecentItem(new Date(now.getTime() - 1000).toISOString(), now)).toBe(true));
  it("rejects items outside the window", () =>
    expect(isRecentItem(new Date(now.getTime() - NEW_ITEM_PUSH_WINDOW_MS - 1).toISOString(), now)).toBe(false));
  it("rejects bad dates", () => expect(isRecentItem("nope", now)).toBe(false));
});

describe("install prompt rules", () => {
  it("detects iPhone and iPadOS (which reports as a Mac)", () => {
    expect(isAppleMobile("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(isAppleMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isAppleMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isAppleMobile("Mozilla/5.0 (Linux; Android 15)", 5)).toBe(false);
  });

  it("snoozes after dismissal and hides for good once installed", () => {
    const now = 1_000_000_000_000;
    expect(isInstallPromptHidden(null, now)).toBe(false);
    expect(isInstallPromptHidden("installed", now)).toBe(true);
    expect(isInstallPromptHidden(String(now - 1000), now)).toBe(true);
    expect(isInstallPromptHidden(String(now - INSTALL_SNOOZE_MS - 1), now)).toBe(false);
    expect(isInstallPromptHidden("garbage", now)).toBe(false);
  });
});
