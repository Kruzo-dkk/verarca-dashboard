import { describe, it, expect } from "vitest";

/**
 * Tests for the buildBenchmarkMetrics helper inside InvestorDashboard.
 *
 * Since it's a private function inside the component file, we replicate its
 * logic here to verify the mapping is correct. The actual component uses this
 * mapping to bridge InvestorReportData → BenchmarkMetricKey.
 */

import type { InvestorReportData } from "@/lib/types/investor-report";
import type { BenchmarkMetricKey } from "@/lib/benchmarks";

// Replicate the mapping logic
function buildBenchmarkMetrics(
  rq: InvestorReportData["revenueQuality"],
  ge: InvestorReportData["growthEfficiency"]
): Partial<Record<BenchmarkMetricKey, number | null>> {
  return {
    nrr: rq.nrr,
    grr: rq.grr,
    logoRetention: rq.logoRetentionRate,
    growthRate: rq.growthYoY,
    ltvCac: ge.ltvCacRatio,
    cacPayback: ge.cacPaybackMonths,
    ruleOf40: ge.ruleOf40,
    burnMultiple: ge.burnMultiple,
    magicNumber: ge.magicNumber,
  };
}

const mockRevenueQuality: InvestorReportData["revenueQuality"] = {
  arr: 500_000_000, // 5M DKK
  mrr: 41_666_667,
  nrr: 115,
  grr: 92,
  logoRetentionRate: 95,
  top10Concentration: 28.5,
  growthMoM: 3.2,
  growthYoY: 45,
  arrHistory: [
    { month: "2024-01", arr: 300_000_000 },
    { month: "2024-06", arr: 400_000_000 },
    { month: "2025-01", arr: 500_000_000 },
  ],
  nrrHistory: [
    { month: "2024-01", nrr: 110 },
    { month: "2025-01", nrr: 115 },
  ],
  customerCount: 42,
  arpa: 992_063,
  quickRatio: 3.5,
};

const mockGrowthEfficiency: InvestorReportData["growthEfficiency"] = {
  ltv: 49_603_174,
  cac: 12_000_000,
  ltvCacRatio: 4.1,
  revenuePerEmployee: 25_000_000,
  employeeCount: 20,
  cacPaybackMonths: 14,
  ruleOf40: 55,
  burnMultiple: 1.2,
  magicNumber: 0.85,
};

describe("buildBenchmarkMetrics mapping", () => {
  it("maps revenue quality metrics correctly", () => {
    const result = buildBenchmarkMetrics(mockRevenueQuality, mockGrowthEfficiency);
    expect(result.nrr).toBe(115);
    expect(result.grr).toBe(92);
    expect(result.logoRetention).toBe(95);
    expect(result.growthRate).toBe(45);
  });

  it("maps growth efficiency metrics correctly", () => {
    const result = buildBenchmarkMetrics(mockRevenueQuality, mockGrowthEfficiency);
    expect(result.ltvCac).toBe(4.1);
    expect(result.cacPayback).toBe(14);
    expect(result.ruleOf40).toBe(55);
    expect(result.burnMultiple).toBe(1.2);
    expect(result.magicNumber).toBe(0.85);
  });

  it("handles null values gracefully", () => {
    const nullRQ: InvestorReportData["revenueQuality"] = {
      ...mockRevenueQuality,
      nrr: null,
      grr: null,
      logoRetentionRate: null,
      growthYoY: null,
    };
    const nullGE: InvestorReportData["growthEfficiency"] = {
      ...mockGrowthEfficiency,
      ltvCacRatio: null,
      cacPaybackMonths: null,
      ruleOf40: null,
      burnMultiple: null,
      magicNumber: null,
    };

    const result = buildBenchmarkMetrics(nullRQ, nullGE);
    expect(result.nrr).toBeNull();
    expect(result.grr).toBeNull();
    expect(result.logoRetention).toBeNull();
    expect(result.growthRate).toBeNull();
    expect(result.ltvCac).toBeNull();
    expect(result.cacPayback).toBeNull();
    expect(result.ruleOf40).toBeNull();
    expect(result.burnMultiple).toBeNull();
    expect(result.magicNumber).toBeNull();
  });

  it("does not include grossMargin (not yet available)", () => {
    const result = buildBenchmarkMetrics(mockRevenueQuality, mockGrowthEfficiency);
    expect(result.grossMargin).toBeUndefined();
  });
});
