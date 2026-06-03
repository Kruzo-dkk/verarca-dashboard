import { describe, it, expect } from "vitest";
import {
  calculateNRR,
  calculateGRR,
  calculateQuickRatio,
  calculateConcentration,
  calculateLTV,
  calculateRevenuePerEmployee,
  calculateLogoRetention,
  calculateLogoChurnRate,
  calculateRevenueChurnRate,
  calculateMRRGrowth,
  countActiveCustomers,
  collapseLinkedSnapshots,
  buildActiveCountByCanonical,
  suppressLinkedChurn,
  decomposeMRR,
  decomposeMRRByCustomer,
  getChurnedCustomers,
  getNewCustomers,
  eventChurnedCanonicalIds,
  getMonthlyChurn,
  getMonthlyChurnFromSnapshots,
  type CustomerMRRSnapshot,
  type SnapshotForChurn,
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

// ─── Logo Churn Rate ────────────────────────────────────────────

describe("calculateLogoChurnRate", () => {
  it("returns 0 when no customers were active at start", () => {
    expect(calculateLogoChurnRate(0, 0)).toBe(0);
  });

  it("calculates correct rate", () => {
    // 5 churned out of 50 active → 10%
    expect(calculateLogoChurnRate(5, 50)).toBe(10);
  });

  it("counts zero-MRR churners (pre-invoice churn) the same as any logo", () => {
    // Two churners contributing kr 0 MRR still count as logo churn
    expect(calculateLogoChurnRate(2, 100)).toBe(2);
  });

  it("returns 0 when no churn", () => {
    expect(calculateLogoChurnRate(0, 100)).toBe(0);
  });
});

// ─── Revenue Churn Rate ─────────────────────────────────────────

describe("calculateRevenueChurnRate", () => {
  it("returns 0 when start MRR is 0", () => {
    expect(calculateRevenueChurnRate(0, 0)).toBe(0);
  });

  it("calculates correct rate", () => {
    // 5K churned of 100K start → 5%
    expect(calculateRevenueChurnRate(5_000, 100_000)).toBe(5);
  });

  it("returns 0 when only zero-MRR customers churned", () => {
    // Pre-invoice churners contribute 0 to churnedMRR by construction
    expect(calculateRevenueChurnRate(0, 100_000)).toBe(0);
  });

  it("diverges from logo churn when a large customer churns", () => {
    // 1 customer of 100 churned, but they had 50K of 100K MRR
    // Logo churn = 1% but revenue churn = 50%
    expect(calculateLogoChurnRate(1, 100)).toBe(1);
    expect(calculateRevenueChurnRate(50_000, 100_000)).toBe(50);
  });
});

// ─── getMonthlyChurnFromSnapshots ───────────────────────────────

describe("getMonthlyChurnFromSnapshots", () => {
  function snap(overrides: Partial<SnapshotForChurn> & { month: string }): SnapshotForChurn {
    return {
      month: overrides.month,
      mrr: overrides.mrr ?? 0,
      customer_count: overrides.customer_count ?? 0,
      churned_logos: overrides.churned_logos ?? 0,
      churned_mrr: overrides.churned_mrr ?? 0,
    };
  }

  it("returns both logo and revenue churn rates per month", () => {
    const snapshots: SnapshotForChurn[] = [
      snap({ month: "2026-01", mrr: 100_000, customer_count: 100 }),
      snap({
        month: "2026-02",
        mrr: 95_000,
        customer_count: 98,
        churned_logos: 5,
        churned_mrr: 5_000,
      }),
    ];

    const result = getMonthlyChurnFromSnapshots(snapshots);
    const feb = result.find((r) => r.month === "2026-02")!;
    // activeAtStart from prev month = 100; 5/100 = 5%
    expect(feb.logoChurnRate).toBe(5);
    // startMRR from prev month = 100_000; 5_000/100_000 = 5%
    expect(feb.revenueChurnRate).toBe(5);
  });

  it("zero-MRR-only churn month has logo rate > 0 and revenue rate = 0", () => {
    const snapshots: SnapshotForChurn[] = [
      snap({ month: "2026-01", mrr: 100_000, customer_count: 100 }),
      snap({
        month: "2026-02",
        mrr: 100_000,
        customer_count: 98,
        churned_logos: 2,
        churned_mrr: 0,
      }),
    ];

    const result = getMonthlyChurnFromSnapshots(snapshots);
    const feb = result.find((r) => r.month === "2026-02")!;
    expect(feb.logoChurnRate).toBeGreaterThan(0);
    expect(feb.revenueChurnRate).toBe(0);
  });

  it("sorts input by month ascending", () => {
    const snapshots: SnapshotForChurn[] = [
      snap({ month: "2026-03", mrr: 90_000, customer_count: 90, churned_logos: 1, churned_mrr: 1_000 }),
      snap({ month: "2026-01", mrr: 100_000, customer_count: 100 }),
      snap({ month: "2026-02", mrr: 95_000, customer_count: 95, churned_logos: 1, churned_mrr: 1_000 }),
    ];

    const result = getMonthlyChurnFromSnapshots(snapshots);
    expect(result.map((r) => r.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("exposes churnedMRR and startMRR for tooltip display", () => {
    const snapshots: SnapshotForChurn[] = [
      snap({ month: "2026-01", mrr: 200_000, customer_count: 50 }),
      snap({
        month: "2026-02",
        mrr: 180_000,
        customer_count: 48,
        churned_logos: 2,
        churned_mrr: 20_000,
      }),
    ];

    const feb = getMonthlyChurnFromSnapshots(snapshots).find((r) => r.month === "2026-02")!;
    expect(feb.churnedMRR).toBe(20_000);
    expect(feb.startMRR).toBe(200_000);
    expect(feb.activeAtStart).toBe(50);
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

  it("treats status=churned mrr=0 rows as churn, not contraction", () => {
    // Snapshot tables include every customer every month; inactive rows have
    // status="churned" and mrr=0. Previously those were counted as contraction.
    const prev = [snap("A", 10_000), snap("B", 20_000)];
    const curr: CustomerMRRSnapshot[] = [
      snap("A", 10_000),
      { customerId: "B", mrr: 0, status: "churned", planHandle: "plan-1" },
    ];

    const result = decomposeMRR(curr, prev);
    expect(result.churnedMRR).toBe(20_000);
    expect(result.contractionMRR).toBe(0);
  });

  it("treats prev status=churned mrr=0 rows as absent, so new logos are new MRR", () => {
    // A customer added mid-history has backfilled churned/0 snapshots before
    // their start month. Their first real month should read as new MRR.
    const prev: CustomerMRRSnapshot[] = [
      { customerId: "C", mrr: 0, status: "churned", planHandle: "plan-1" },
    ];
    const curr = [snap("C", 5_000)];

    const result = decomposeMRR(curr, prev);
    expect(result.newMRR).toBe(5_000);
    expect(result.expansionMRR).toBe(0);
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
    expired_date?: string;
    cancelled_date?: string;
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
      expired_date: overrides.expired_date,
      cancelled_date: overrides.cancelled_date,
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
        expired_date: midMonth,
      }),
      makeSub({
        handle: "sub-cancelled",
        state: "cancelled",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        cancelled_date: midMonth,
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
        expired_date: midMonth,
      }),
      makeSub({
        handle: "sub-admin-delete",
        state: "expired",
        created: "2024-01-01T00:00:00Z",
        activated: beforeMonth,
        expired_date: midMonth,
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

describe("collapseLinkedSnapshots", () => {
  it("collapses two linked ids into one customer and sums MRR", () => {
    const snaps = [
      { customerId: "16", mrr: 1199, status: "active", planHandle: "p" },
      { customerId: "79", mrr: 2199, status: "active", planHandle: "p" },
    ];
    const links = new Map([["79", "16"]]); // secondary 79 -> canonical 16
    const result = collapseLinkedSnapshots(snaps, links);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ canonicalId: "16", mrr: 3398, active: true });
  });

  it("group is active if ANY member is active, even when the canonical churned", () => {
    const snaps = [
      { customerId: "46", mrr: 6041, status: "active", planHandle: "p" },
      { customerId: "74", mrr: 0, status: "churned", planHandle: "" },
    ];
    const links = new Map([["74", "46"]]);
    const [collapsed] = collapseLinkedSnapshots(snaps, links);
    expect(collapsed.active).toBe(true);
    expect(collapsed.mrr).toBe(6041);
  });

  it("with no links, returns one entry per snapshot (identity)", () => {
    const snaps = [
      { customerId: "1", mrr: 100, status: "active", planHandle: "p" },
      { customerId: "2", mrr: 0, status: "churned", planHandle: "" },
    ];
    expect(collapseLinkedSnapshots(snaps)).toHaveLength(2);
  });
});

describe("countActiveCustomers with links", () => {
  it("counts two active linked rows as one logo", () => {
    const snaps = [
      { customerId: "16", mrr: 1199, status: "active", planHandle: "p" },
      { customerId: "79", mrr: 2199, status: "active", planHandle: "p" },
    ];
    expect(countActiveCustomers(snaps, new Map([["79", "16"]]))).toBe(1);
  });

  it("regression: identical result to no-arg form when links are empty", () => {
    const snaps = [
      { customerId: "1", mrr: 100, status: "active", planHandle: "p" },
      { customerId: "2", mrr: 0, status: "churned", planHandle: "" },
      { customerId: "3", mrr: 50, status: "active", planHandle: "p" },
    ];
    expect(countActiveCustomers(snaps, new Map())).toBe(countActiveCustomers(snaps));
    expect(countActiveCustomers(snaps)).toBe(2);
  });
});

describe("suppressLinkedChurn", () => {
  const links = new Map([["cust-0074", "cust-0046"]]); // secondary -> canonical
  const activeCanon = new Set(["cust-0046"]);

  it("removes a churned sibling whose group still has an active member", () => {
    const churned = [{ customer: "cust-0074", handle: "s1" }];
    expect(suppressLinkedChurn(churned, links, activeCanon)).toHaveLength(0);
  });

  it("keeps a genuinely churned customer with no active sibling", () => {
    const churned = [{ customer: "cust-9999", handle: "s2" }];
    expect(suppressLinkedChurn(churned, links, activeCanon)).toHaveLength(1);
  });

  it("does not suppress a non-linked customer even if its own handle is active", () => {
    // cust-solo is not part of any link → its churn is out of scope, even
    // though it appears in the active set (e.g. a same-handle plan change).
    const churned = [{ customer: "cust-solo", handle: "s3" }];
    expect(
      suppressLinkedChurn(churned, links, new Set(["cust-0046", "cust-solo"]))
    ).toHaveLength(1);
  });
});

describe("decomposeMRR with linked groups (collapse)", () => {
  const a = (id: string, mrr: number): CustomerMRRSnapshot => ({ customerId: id, mrr, status: "active", planHandle: "p" });
  const churned = (id: string): CustomerMRRSnapshot => ({ customerId: id, mrr: 0, status: "churned", planHandle: "" });

  it("a linked sibling churning while canonical stays active is NOT churn", () => {
    // canonical "1" active both months; sibling "2" active last month, gone now.
    const prev = [a("1", 2000), a("2", 2000)];
    const curr = [a("1", 2000), churned("2")];
    const links = new Map([["2", "1"]]); // secondary 2 -> canonical 1
    const r = decomposeMRR(curr, prev, links);
    expect(r.churnedMRR).toBe(0); // group still active
    expect(r.contractionMRR).toBe(2000); // group went 4000 -> 2000
    expect(r.newMRR).toBe(0);
  });

  it("a fully-gone unlinked customer is churn", () => {
    const prev = [a("1", 2499), a("2", 1199)];
    const curr = [churned("1"), churned("2")];
    const r = decomposeMRR(curr, prev);
    expect(r.churnedMRR).toBe(3698);
  });
});

describe("getChurnedCustomers", () => {
  const a = (id: string, mrr: number): CustomerMRRSnapshot => ({ customerId: id, mrr, status: "active", planHandle: "p" });
  const churned = (id: string): CustomerMRRSnapshot => ({ customerId: id, mrr: 0, status: "churned", planHandle: "" });

  it("lists only fully-churned groups with the MRR lost", () => {
    const prev = [a("esmark", 2499), a("era", 1199), a("1", 2000), a("2", 2000)];
    const curr = [churned("esmark"), churned("era"), a("1", 2000), churned("2")];
    const links = new Map([["2", "1"]]);
    const out = getChurnedCustomers(curr, prev, links).sort((x, y) => y.mrr - x.mrr);
    expect(out).toEqual([
      { canonicalId: "esmark", mrr: 2499 },
      { canonicalId: "era", mrr: 1199 },
    ]);
  });
});

describe("getNewCustomers", () => {
  const a = (id: string, mrr: number): CustomerMRRSnapshot => ({ customerId: id, mrr, status: "active", planHandle: "p" });
  const churned = (id: string): CustomerMRRSnapshot => ({ customerId: id, mrr: 0, status: "churned", planHandle: "" });

  it("lists customers active now that were not active last month", () => {
    const prev = [a("existing", 1000), churned("newbie")];
    const curr = [a("existing", 1000), a("newbie", 500)];
    const out = getNewCustomers(curr, prev);
    expect(out).toEqual([{ canonicalId: "newbie", mrr: 500 }]);
  });

  it("a linked secondary going active under an already-active canonical is NOT new", () => {
    const prev = [a("1", 2000)];
    const curr = [a("1", 2000), a("2", 2000)];
    const links = new Map([["2", "1"]]); // 2 -> canonical 1 (already active)
    expect(getNewCustomers(curr, prev, links)).toEqual([]);
  });
});

describe("eventChurnedCanonicalIds", () => {
  const cust = (id: number, handle: string, churn_date: string | null, status: string) =>
    ({ id, frisbii_handle: handle, churn_date, status });

  it("includes customers whose sub ended in the month and excludes still-active groups", () => {
    const customers = [
      cust(65, "tommytelt", "2026-03-13", "churned"),
      cust(91, "gearupgreen", "2026-03-23", "expired"),
      cust(46, "anders-a", "2026-03-31", "active"),   // canonical active -> not churn
      cust(10, "feb-closer", "2026-02-20", "churned"), // wrong month
    ];
    const ids = eventChurnedCanonicalIds("2026-03", "2026-03", customers, new Map());
    expect([...ids].sort()).toEqual([65, 91]);
  });

  it("a churned linked secondary maps to its canonical and is suppressed if canonical active", () => {
    const customers = [
      cust(46, "cust-0046", null, "active"),
      cust(74, "cust-0074", "2026-03-31", "expired"),
    ];
    const links = new Map([["cust-0074", "cust-0046"]]);
    const ids = eventChurnedCanonicalIds("2026-03", "2026-03", customers, links);
    expect(ids.size).toBe(0); // canonical 46 still active
  });

  it("range bounds are inclusive across months", () => {
    const customers = [
      cust(1, "a", "2026-01-05", "churned"),
      cust(2, "b", "2026-03-28", "churned"),
      cust(3, "c", "2026-04-02", "churned"),
    ];
    const ids = eventChurnedCanonicalIds("2026-01", "2026-03", customers, new Map());
    expect([...ids].sort()).toEqual([1, 2]);
  });
});

describe("decomposeMRRByCustomer", () => {
  const a = (id: string, mrr: number): CustomerMRRSnapshot => ({ customerId: id, mrr, status: "active", planHandle: "p" });
  const churned = (id: string): CustomerMRRSnapshot => ({ customerId: id, mrr: 0, status: "churned", planHandle: "" });

  it("classifies each customer and the amounts sum to decomposeMRR", () => {
    const prev = [a("A", 10_000), a("B", 20_000), a("C", 5_000)];
    const curr = [a("A", 15_000), a("B", 18_000), a("D", 8_000), churned("C")];
    const bd = decomposeMRRByCustomer(curr, prev);
    expect(bd.newCustomers).toEqual([{ canonicalId: "D", amount: 8_000, fromMrr: 0, toMrr: 8_000 }]);
    expect(bd.expansion).toEqual([{ canonicalId: "A", amount: 5_000, fromMrr: 10_000, toMrr: 15_000 }]);
    expect(bd.contraction).toEqual([{ canonicalId: "B", amount: 2_000, fromMrr: 20_000, toMrr: 18_000 }]);
    expect(bd.churned).toEqual([{ canonicalId: "C", amount: 5_000, fromMrr: 5_000, toMrr: 0 }]);

    const sums = decomposeMRR(curr, prev);
    expect(bd.newCustomers.reduce((s, x) => s + x.amount, 0)).toBe(sums.newMRR);
    expect(bd.expansion.reduce((s, x) => s + x.amount, 0)).toBe(sums.expansionMRR);
    expect(bd.contraction.reduce((s, x) => s + x.amount, 0)).toBe(sums.contractionMRR);
    expect(bd.churned.reduce((s, x) => s + x.amount, 0)).toBe(sums.churnedMRR);
  });

  it("collapses linked siblings: sibling churn under active canonical = contraction", () => {
    const prev = [a("1", 2_000), a("2", 2_000)];
    const curr = [a("1", 2_000), churned("2")];
    const bd = decomposeMRRByCustomer(curr, prev, new Map([["2", "1"]]));
    expect(bd.churned).toEqual([]);
    expect(bd.contraction).toEqual([{ canonicalId: "1", amount: 2_000, fromMrr: 4_000, toMrr: 2_000 }]);
  });
});

describe("collapseLinkedSnapshots top-K (re-signup de-duplication)", () => {
  const a = (id: string, mrr: number): CustomerMRRSnapshot => ({ customerId: id, mrr, status: "active", planHandle: "p" });

  it("re-signup group (K=1) takes the single highest member MRR, not the sum", () => {
    // Christina: 3 handles all 'active' at 2000 in one month, one real sub.
    const snaps = [a("169", 2000), a("170", 2000), a("171", 2000)];
    const links = new Map([["169", "171"], ["170", "171"]]); // → canonical 171
    const k = new Map([["171", 1]]);
    const [g] = collapseLinkedSnapshots(snaps, links, k);
    expect(g.mrr).toBe(2000);
    expect(g.active).toBe(true);
  });

  it("genuine concurrent group (K=2) sums the top-2", () => {
    const snaps = [a("16", 1199), a("79", 2199)];
    const links = new Map([["79", "16"]]);
    const k = new Map([["16", 2]]);
    const [g] = collapseLinkedSnapshots(snaps, links, k);
    expect(g.mrr).toBe(3398);
  });

  it("without activeCount, sums all members (legacy)", () => {
    const snaps = [a("169", 2000), a("170", 2000), a("171", 2000)];
    const links = new Map([["169", "171"], ["170", "171"]]);
    const [g] = collapseLinkedSnapshots(snaps, links);
    expect(g.mrr).toBe(6000);
  });
});

describe("buildActiveCountByCanonical", () => {
  it("counts currently-active members per canonical", () => {
    const customers = [
      { id: 171, frisbii_handle: "cust-0171", status: "active" },
      { id: 169, frisbii_handle: "cust-0169", status: "churned" },
      { id: 170, frisbii_handle: "cust-0170", status: "churned" },
      { id: 16, frisbii_handle: "cust-0016", status: "active" },
      { id: 79, frisbii_handle: "cust-0079", status: "active" },
    ];
    const links = new Map([
      ["cust-0169", "cust-0171"],
      ["cust-0170", "cust-0171"],
      ["cust-0079", "cust-0016"],
    ]);
    const counts = buildActiveCountByCanonical(customers, links);
    expect(counts.get("171")).toBe(1); // re-signup: only 0171 active
    expect(counts.get("16")).toBe(2);  // concurrent: 0016 + 0079
  });
});
