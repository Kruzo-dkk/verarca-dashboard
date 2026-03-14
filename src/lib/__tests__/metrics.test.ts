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

  it("returns 0 when churn rate is 0", () => {
    expect(calculateLTV(10_000, 0)).toBe(0);
  });

  it("returns 0 when churn rate is negative", () => {
    expect(calculateLTV(10_000, -1)).toBe(0);
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
