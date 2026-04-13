import { describe, it, expect } from "vitest";
import {
  computeCommittedMRR,
  type DiscountSnapshotRow,
} from "../committed-mrr";

function buildDiscount(
  overrides: Partial<DiscountSnapshotRow> = {}
): DiscountSnapshotRow {
  return {
    monthly_impact: 10_000, // 100 DKK
    discount_name: "Launch discount",
    discount_percentage: 20,
    discount_type: "percentage",
    expires_at: "2026-06-01T00:00:00Z",
    subscription_handle: "sub-1",
    customer_id: 1,
    ...overrides,
  };
}

// ─── computeCommittedMRR ─────────────────────────────────────────

describe("computeCommittedMRR", () => {
  it("computes billedMRR = listPrice - discounts", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({ monthly_impact: 50_000 }),
    ]);
    expect(result.listPriceMRR).toBe(500_000);
    expect(result.billedMRR).toBe(450_000);
    expect(result.totalDiscountImpact).toBe(50_000);
    expect(result.discountCount).toBe(1);
  });

  it("returns listPrice when no discounts", () => {
    const result = computeCommittedMRR(500_000, []);
    expect(result.billedMRR).toBe(500_000);
    expect(result.totalDiscountImpact).toBe(0);
    expect(result.discountCount).toBe(0);
    expect(result.upcomingExpirations).toHaveLength(0);
  });

  it("sums multiple discount impacts", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({ monthly_impact: 20_000 }),
      buildDiscount({ monthly_impact: 30_000, subscription_handle: "sub-2" }),
    ]);
    expect(result.totalDiscountImpact).toBe(50_000);
    expect(result.billedMRR).toBe(450_000);
  });

  it("billedMRR never goes below 0", () => {
    const result = computeCommittedMRR(10_000, [
      buildDiscount({ monthly_impact: 50_000 }),
    ]);
    expect(result.billedMRR).toBe(0);
  });

  it("handles null monthly_impact as 0", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({ monthly_impact: null }),
    ]);
    expect(result.totalDiscountImpact).toBe(0);
    expect(result.billedMRR).toBe(500_000);
  });

  // ─── Expiration grouping ────────────────────────────────────

  it("groups expirations by month", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({
        monthly_impact: 10_000,
        expires_at: "2026-06-15T00:00:00Z",
      }),
      buildDiscount({
        monthly_impact: 20_000,
        expires_at: "2026-06-01T00:00:00Z",
        subscription_handle: "sub-2",
      }),
      buildDiscount({
        monthly_impact: 15_000,
        expires_at: "2026-09-01T00:00:00Z",
        subscription_handle: "sub-3",
      }),
    ]);

    expect(result.upcomingExpirations).toHaveLength(2);
    // June: 10,000 + 20,000
    const june = result.upcomingExpirations.find((e) => e.month === "2026-06");
    expect(june).toBeDefined();
    expect(june!.upliftAmount).toBe(30_000);
    expect(june!.discountCount).toBe(2);
    // September: 15,000
    const sept = result.upcomingExpirations.find((e) => e.month === "2026-09");
    expect(sept!.upliftAmount).toBe(15_000);
  });

  it("sorts expirations chronologically", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({ expires_at: "2026-12-01T00:00:00Z" }),
      buildDiscount({
        expires_at: "2026-03-01T00:00:00Z",
        subscription_handle: "sub-2",
      }),
    ]);

    expect(result.upcomingExpirations[0].month).toBe("2026-03");
    expect(result.upcomingExpirations[1].month).toBe("2026-12");
  });

  it("skips discounts without expires_at", () => {
    const result = computeCommittedMRR(500_000, [
      buildDiscount({ expires_at: null }),
    ]);
    expect(result.upcomingExpirations).toHaveLength(0);
    // Discount still counts in the impact
    expect(result.totalDiscountImpact).toBe(10_000);
  });
});
