import { describe, expect, it } from "vitest";

import { calculateEarningsCents } from "./payout";

describe("calculateEarningsCents", () => {
  const payoutPer1kViews = 500;

  it.each([
    [0, 0],
    [999, 0],
    [1_000, 500],
    [1_999, 500],
    [2_000, 1_000],
    [12_850, 6_000],
  ])("floor(%i / 1000) * 500 = %i cents", (views, expected) => {
    expect(calculateEarningsCents(views, payoutPer1kViews)).toBe(expected);
  });

  it("returns 0 when payout rate is 0", () => {
    expect(calculateEarningsCents(50_000, 0)).toBe(0);
  });

  it("rejects negative views", () => {
    expect(() => calculateEarningsCents(-1, 500)).toThrow(RangeError);
  });

  it("rejects negative payout rate", () => {
    expect(() => calculateEarningsCents(1_000, -1)).toThrow(RangeError);
  });

  it("rejects non-integer views", () => {
    expect(() => calculateEarningsCents(1_000.5, 500)).toThrow(RangeError);
  });
});
