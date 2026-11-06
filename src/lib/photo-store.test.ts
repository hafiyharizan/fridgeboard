import { describe, expect, it } from "vitest";
import { fitWithin, MAX_PHOTOS, roomForPhotos } from "@/lib/photo-store";

describe("fitWithin", () => {
  it("leaves small images alone", () => {
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });
  it("scales a wide image so the long side is the max", () => {
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });
  it("scales a tall image so the long side is the max", () => {
    expect(fitWithin(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });
  it("never returns a zero side", () => {
    expect(fitWithin(10000, 1, 1920)).toEqual({ width: 1920, height: 1 });
  });
});

describe("roomForPhotos", () => {
  it("accepts everything while under the cap", () => {
    expect(roomForPhotos(5, 10)).toEqual({ accepted: 10, skipped: 0 });
  });
  it("trims to the cap and reports the rest", () => {
    expect(roomForPhotos(MAX_PHOTOS - 2, 5)).toEqual({ accepted: 2, skipped: 3 });
  });
  it("accepts none when full", () => {
    expect(roomForPhotos(MAX_PHOTOS, 3)).toEqual({ accepted: 0, skipped: 3 });
  });
});
