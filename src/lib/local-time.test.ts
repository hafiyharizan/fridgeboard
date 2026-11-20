import { describe, expect, it } from "vitest";
import { getLocalDateTime } from "@/lib/local-time";

describe("getLocalDateTime", () => {
  it("converts UTC to Perth (UTC+8, no DST)", () => {
    // 23:05 UTC on 2 Nov = 07:05 on 3 Nov in Perth
    expect(getLocalDateTime(new Date("2026-11-02T23:05:00Z"), "Australia/Perth")).toEqual({
      dateKey: "2026-11-03",
      minutes: 7 * 60 + 5,
    });
  });

  it("handles local midnight", () => {
    expect(getLocalDateTime(new Date("2026-11-02T16:00:00Z"), "Australia/Perth")).toEqual({
      dateKey: "2026-11-03",
      minutes: 0,
    });
  });
});
