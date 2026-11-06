import { describe, expect, it } from "vitest";
import { stepIndex, swipeStep } from "./swipe";

describe("swipeStep", () => {
  it("goes next on a long left drag", () => expect(swipeStep(-80, 0)).toBe(1));
  it("goes previous on a long right drag", () => expect(swipeStep(80, 0)).toBe(-1));
  it("accepts a short but fast flick", () => {
    expect(swipeStep(-20, -500)).toBe(1);
    expect(swipeStep(20, 500)).toBe(-1);
  });
  it("stays for a small slow drag", () => expect(swipeStep(-59, -399)).toBe(0));
  it("treats exactly the thresholds as a swipe", () => {
    expect(swipeStep(-60, 0)).toBe(1);
    expect(swipeStep(0, 400)).toBe(-1);
  });
});

describe("stepIndex", () => {
  it("clamps at both ends", () => {
    expect(stepIndex(0, -1, 2)).toBe(0);
    expect(stepIndex(1, 1, 2)).toBe(1);
    expect(stepIndex(0, 1, 2)).toBe(1);
  });
  it("handles an empty or shrunk deck", () => {
    expect(stepIndex(3, 0, 0)).toBe(0);
    expect(stepIndex(3, 0, 1)).toBe(0);
  });
});
