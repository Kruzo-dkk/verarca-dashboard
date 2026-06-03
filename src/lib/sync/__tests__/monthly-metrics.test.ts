import { describe, it, expect } from "vitest";
import { computeMonthlyMetrics } from "@/lib/sync/monthly-metrics";
import type { CustomerMRRSnapshot } from "@/lib/metrics";

const snap = (id: string, mrr: number, status = "active"): CustomerMRRSnapshot => ({
  customerId: id,
  mrr,
  status,
  planHandle: "p",
});

const cust = (id: number, handle: string, status: string, churn_date: string | null) => ({
  id,
  frisbii_handle: handle,
  status,
  churn_date,
});

describe("computeMonthlyMetrics", () => {
  it("computes the headline aggregates from snapshots", () => {
    const prev = [snap("1", 10_000), snap("2", 20_000), snap("3", 5_000)];
    const curr = [snap("1", 15_000), snap("2", 18_000), snap("4", 8_000), snap("3", 0, "churned")];
    const customers = [
      cust(1, "a", "active", null),
      cust(2, "b", "active", null),
      cust(3, "c", "churned", "2026-03-20"),
      cust(4, "d", "active", null),
    ];
    const m = computeMonthlyMetrics({
      month: "2026-03",
      currentSnapshots: curr,
      prevSnapshots: prev,
      customers,
      confirmedLinks: new Map(),
      newLogos: 1,
      prevMonthMRR: 35_000,
      prevYearMRR: null,
    });
    expect(m.mrr).toBe(41_000); // 15k + 18k + 8k
    expect(m.customerCount).toBe(3);
    expect(m.newMRR).toBe(8_000); // customer 4
    expect(m.expansionMRR).toBe(5_000); // 1: +5k
    expect(m.contractionMRR).toBe(2_000); // 2: -2k
    expect(m.churnedMRR).toBe(5_000); // 3 gone (snapshot)
    expect(m.churnedMrrEvent).toBe(0); // 3 had mrr 0 in current snapshot
    expect(m.churnedLogos).toBe(1); // customer 3 closed in March
    expect(m.newLogos).toBe(1);
    expect(m.mrrGrowthMoM).not.toBeNull();
    expect(m.mrrGrowthYoY).toBeNull();
  });

  it("collapses linked re-signups (top-K) so they don't inflate MRR", () => {
    // One real 2.000 sub registered under 3 handles, all 'active' this month.
    const curr = [snap("169", 2_000), snap("170", 2_000), snap("171", 2_000)];
    const customers = [
      cust(171, "cust-0171", "active", null),
      cust(169, "cust-0169", "churned", null),
      cust(170, "cust-0170", "churned", null),
    ];
    const links = new Map([
      ["cust-0169", "cust-0171"],
      ["cust-0170", "cust-0171"],
    ]);
    const m = computeMonthlyMetrics({
      month: "2026-06",
      currentSnapshots: curr,
      prevSnapshots: curr,
      customers,
      confirmedLinks: links,
      newLogos: 0,
      prevMonthMRR: null,
      prevYearMRR: null,
    });
    expect(m.mrr).toBe(2_000); // top-K (K=1), not 6.000
    expect(m.customerCount).toBe(1);
  });
});
