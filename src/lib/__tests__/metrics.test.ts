import { describe, it, expect } from "vitest";
import {
  calculateNRR,
  calculateGRR,
  calculateQuickRatio,
  calculateConcentration,
  calculateLTV,
  calculateRevenuePerEmployee,
  calculateLogoRetention,
  calculateMRRGrowth,
  countActiveCustomers,
  decomposeMRR,
  getMonthlyChurn,
  type CustomerMRRSnapshot,
} from "../metrics";

// ─── NRR ─────────────────────────────────────────────────────────

describe("calculateNRR", () => {
  it("returns 100 when no change in MRR", () => {
    expect(calculateNRR(100_000, 100_000)).toBe(100);
  });

  it("returns > 100 when expansion exceeds churn", () => {
    expect(calculateNRR(100_000, 115_000)).toBe(115);
  });

  it("returns < 100 when churn exceeds expansion", () => {
    expect(calculateNRR(100_000, 90_000)).toBe(90);
  });

  it("returns 0 when start MRR is 0", () => {
    expect(calculateNRR(0, 50_000)).toBe(0);
  });
});

// ─── GRR ─────────────────────────────────────────────────────────

describe("calculateGRR", () => {
  it("returns 100 with no contraction or churn", () => {
    expect(calculateGRR(100_000, 0, 0)).toBe(100);
  });

  it("returns correct value with contraction and churn", () => {
    // 100K - 5K contraction - 5K churn = 90K retained → 90%
    expect(calculateGRR(100_000, 5_000, 5_000)).toBe(90);
  });

  it("returns 0 when start MRR is 0", () => {
    expect(calculateGRR(0, 0, 0)).toBe(0);
  });

  it("floors at 0 (never negative)", () => {
    // Contraction + churn exceeds start MRR
    expect(calculateGRR(100_000, 60_000, 60_000)).toBe(0);
  });
});

// ─── Quick Ratio ─────────────────────────────────────────────────

describe("calculateQuickRatio", () => {
  it("returns Infinity when no losses and positive gains", () => {
    expect(calculateQuickRatio(10_000, 5_000, 0, 0)).toBe(Infinity);
  });

  it("returns 0 when no gains and no losses", () => {
    expect(calculateQuickRatio(0, 0, 0, 0)).toBe(0);
  });

  it("calculates correct ratio", () => {
    // (10K + 5K) / (3K + 2K) = 15K / 5K = 3.0
    expect(calculateQuickRatio(10_000, 5_000, 3_000, 2_000)).toBe(3);
  });

  it("returns < 1 when losses exceed gains", () => {
    // (2K + 1K) / (5K + 5K) = 3K / 10K = 0.3
    expect(calculateQuickRatio(2_000, 1_000, 5_000, 5_000)).toBe(0.3);
  });
});

// ─── Concentration ───────────────────────────────────────────────

describe("calculateConcentration", () => {
  it("returns 100 when all MRR from 1 customer (top 10)", () => {
    expect(calculateConcentration([50_000])).toBe(100);
  });

  it("returns 0 for empty array", () => {
    expect(calculateConcentration([])).toBe(0);
  });

  it("returns 0 for all-zero MRR", () => {
    expect(calculateConcentration([0, 0, 0])).toBe(0);
  });

  it("correctly sums top N customers", () => {
    // 20 customers, each 5K MRR → top 10 = 50K / 100K = 50%
    const mrrs = Array(20).fill(5_000);
    expect(calculateConcentration(mrrs, 10)).toBe(50);
  });

  it("sorts by descending MRR before slicing", () => {
    // [1, 2, 3, 4, 5] → top 2 = 5 + 4 = 9 / 15 = 60%
    expect(calculateConcentration([1, 2, 3, 4, 5], 2)).toBe(60);
  });
});

// ─── LTV ─────────────────────────────────────────────────────────

describe("calculateLTV", () => {
  it("calculates LTV from ARPA and churn rate", () => {
    // ARPA = 10,000 øre, churn = 2% → LTV = 10,000 / 0.02 = 500,000
    expect(calculateLTV(10_000, 2)).toBe(500_000);
  });

  it("caps at 60 months when churn rate is 0", () => {
    // ARPA 10,000 × 60 months = 600,000
    expect(calculateLTV(10_000, 0)).toBe(600_000);
  });

  it("caps at 60 months when churn rate is negative", () => {
    expect(calculateLTV(10_000, -1)).toBe(600_000);
  });
});

// ─── Revenue per Employee ────────────────────────────────────────

describe("calculateRevenuePerEmployee", () => {
  it("divides ARR by employee count", () => {
    expect(calculateRevenuePerEmployee(1_000_000, 10)).toBe(100_000);
  });

  it("returns 0 when no employees", () => {
    expect(calculateRevenuePerEmployee(1_000_000, 0)).toBe(0);
  });
});

// ─── Logo Retention ──────────────────────────────────────────────

describe("calculateLogoRetention", () => {
  it("returns 100 when no churned customers", () => {
    expect(calculateLogoRetention(50, 0)).toBe(100);
  });

  it("returns correct rate", () => {
    // 50 start, 5 churned → 90%
    expect(calculateLogoRetention(50, 5)).toBe(90);
  });

  it("returns 0 when start is 0", () => {
    expect(calculateLogoRetention(0, 0)).toBe(0);
  });
});

// ─── MRR Growth ──────────────────────────────────────────────────

describe("calculateMRRGrowth", () => {
  it("returns 0 when previous is 0 and current is 0", () => {
    expect(calculateMRRGrowth(0, 0)).toBe(0);
  });

  it("returns 100 when previous is 0 but current is positive", () => {
    expect(calculateMRRGrowth(50_000, 0)).toBe(100);
  });

  it("calculates positive growth", () => {
    // (120K - 100K) / 100K = 20%
    expect(calculateMRRGrowth(120_000, 100_000)).toBe(20);
  });

  it("calculates negative growth", () => {
    // (80K - 100K) / 100K = -20%
    expect(calculateMRRGrowth(80_000, 100_000)).toBe(-20);
  });
});

// ─── decomposeMRR ───────────────────────────────────────────────

describe("decomposeMRR", () => {
  const snap = (id: string, mrr: number): CustomerMRRSnapshot => ({
    customerId: id,
    mrr,
    status: "active",
    planHandle: "plan-1",
  });

  it("identifies new, churned, expansion, and contraction", () => {
    const prev = [snap("A", 10_000), snap("B", 20_000), snap("C", 5_000)];
    const curr = [snap("A", 15_000), snap("B", 18_000), snap("D", 8_000)];
    // A: expansion +5K, B: contraction -2K, C: churned 5K, D: new 8K

    const result = decomposeMRR(curr, prev);
    expect(result.newMRR).toBe(8_000);
    expect(result.expansionMRR).toBe(5_000);
    expect(result.contractionMRR).toBe(2_000);
    expect(result.churnedMRR).toBe(5_000);
    expect(result.netNewMRR).toBe(8_000 + 5_000 - 2_000 - 5_000); // 6000
  });

  it("returns all zeros when snapshots are identical", () => {
    const both = [snap("A", 10_000)];
    const result = decomposeMRR(both, both);
    expect(result.newMRR).toBe(0);
    expect(result.churnedMRR).toBe(0);
    expect(result.expansionMRR).toBe(0);
    expect(result.contractionMRR).toBe(0);
  });

  it("treats linked customers as continuity, not churn+new", () => {
    // Customer "old-1" (ID 1) was replaced by "new-1" (ID 2)
    const prev = [snap("1", 10_000)];
    const curr = [snap("2", 12_000)];
    const links = new Map([["1", "2"]]); // old -> new

    const result = decomposeMRR(curr, prev, links);
    // Should be expansion (+2K), NOT churn (10K) + new (12K)
    expect(result.expansionMRR).toBe(2_000);
    expect(result.churnedMRR).toBe(0);
    expect(result.newMRR).toBe(0);
  });

  it("treats linked customer with lower MRR as contraction", () => {
    const prev = [snap("1", 10_000)];
    const curr = [snap("2", 7_000)];
    const links = new Map([["1", "2"]]);

    const result = decomposeMRR(curr, prev, links);
    expect(result.contractionMRR).toBe(3_000);
    expect(result.churnedMRR).toBe(0);
    expect(result.newMRR).toBe(0);
  });
});

// ─── getMonthlyChurn ────────────────────────────────────────────

describe("getMonthlyChurn", () => {
  // Helper to create a minimal subscription-like object
  function makeSub(overrides: {
    handle: string;
    state: string;
    created: string;
    activated?: string;
    expired?: string;
    cancelled?: string;
  }) {
    return {
      handle: overrides.handle,
      state: overrides.state,
      customer: "cust-1",
      plan: "plan-1",
      quantity: 1,
      currency: "DKK",
      created: overrides.created,
      activated: overrides.activated,
      expired: overrides.expired,
      cancelled: overrides.cancelled,
      plan_version: 1,
    };
  }

  it("counts both expired and cancelled as churn", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const midMonth = `${thisMonth}-15T00:00:00Z`;
    const beforeMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01T00:00:00Z`;

    const subs = [
      makeSub({
        handle: "sub-expired",
        state: "expired",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        expired: midMonth,
      }),
      makeSub({
        handle: "sub-cancelled",
        state: "cancelled",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        cancelled: midMonth,
      }),
      makeSub({
        handle: "sub-active",
        state: "active",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
      }),
    ];

    const result = getMonthlyChurn(subs, 1);
    // Both expired and cancelled should be counted
    expect(result[0].expiredCount).toBe(2);
  });

  it("excludes subscriptions in the exclusion set", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const midMonth = `${thisMonth}-15T00:00:00Z`;
    const beforeMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01T00:00:00Z`;

    const subs = [
      makeSub({
        handle: "sub-real-churn",
        state: "expired",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        expired: midMonth,
      }),
      makeSub({
        handle: "sub-admin-delete",
        state: "expired",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        expired: midMonth,
      }),
      makeSub({
        handle: "sub-active",
        state: "active",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
      }),
    ];

    const excluded = new Set(["sub-admin-delete"]);
    const result = getMonthlyChurn(subs, 1, excluded);
    // Only the real churn should count
    expect(result[0].expiredCount).toBe(1);
  });
});

// ─── countActiveCustomers ───────────────────────────────────────

describe("countActiveCustomers", () => {
  it("counts only active customers with MRR > 0", () => {
    const snapshots: CustomerMRRSnapshot[] = [
      { customerId: "1", mrr: 50_000, status: "active", planHandle: "plan-a" },
      { customerId: "2", mrr: 30_000, status: "active", planHandle: "plan-b" },
      { customerId: "3", mrr: 0, status: "active", planHandle: "plan-c" },
      { customerId: "4", mrr: 10_000, status: "churned", planHandle: "plan-a" },
    ];
    // Only customers 1 and 2 are active with MRR > 0
    expect(countActiveCustomers(snapshots)).toBe(2);
  });

  it("returns 0 for empty snapshots", () => {
    expect(countActiveCustomers([])).toBe(0);
  });

  it("returns 0 when all customers are churned", () => {
    const snapshots: CustomerMRRSnapshot[] = [
      { customerId: "1", mrr: 0, status: "churned", planHandle: "plan-a" },
      { customerId: "2", mrr: 0, status: "churned", planHandle: "plan-b" },
    ];
    expect(countActiveCustomers(snapshots)).toBe(0);
  });

  it("excludes active customers with zero MRR", () => {
    const snapshots: CustomerMRRSnapshot[] = [
      { customerId: "1", mrr: 0, status: "active", planHandle: "plan-a" },
      { customerId: "2", mrr: 100, status: "active", planHandle: "plan-b" },
    ];
    expect(countActiveCustomers(snapshots)).toBe(1);
  });
});
