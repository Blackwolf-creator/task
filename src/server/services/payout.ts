/**
 * Earnings are floor(views / 1000) * payoutPer1kViewsCents. Everything stays
 * an integer number of cents — no floating point money anywhere.
 */
export function calculateEarningsCents(
  views: number,
  payoutPer1kViewsCents: number,
): number {
  if (!Number.isInteger(views) || views < 0) {
    throw new RangeError("views must be a non-negative integer");
  }

  if (
    !Number.isInteger(payoutPer1kViewsCents) ||
    payoutPer1kViewsCents < 0
  ) {
    throw new RangeError(
      "payoutPer1kViewsCents must be a non-negative integer",
    );
  }

  return Math.floor(views / 1000) * payoutPer1kViewsCents;
}
