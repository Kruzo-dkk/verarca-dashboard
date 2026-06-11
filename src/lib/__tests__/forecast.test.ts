import { describe, it, expect } from "vitest";
import {
  projectScenario,
  computePredictedAssumptions,
  deriveSuggestedBand,
  clampPct,
  PREDICTED_FALLBACK,
  type ForecastAssumptions,
  type TrailingSnapshot,
} from "../forecast";

// Build a trailing snapshot with sensible defaults; override per-test.
function snap(month: string, over: Partial<TrailingSnapshot> = {}): TrailingSnapshot {
  return {
    month,
    mrr: 1_000_000,
    churned_mrr: 0,
    contraction_mrr: 0,
    expansion_mrr: 0,
    new_mrr: 0,
    new_logos: 0,
    arpa: 50_000,
    ...over,
  };
}

const finalMrr = (a: ForecastAssumptions): number => {
  const months = projectScenario(1_000_000, a, 12, "2026-03");
  return months[months.length - 1].mrr;
};

const BASE_ASSUMPTIONS: ForecastAssumptions = {
  scenario: "base",
  monthlyChurnPct: 2,
  monthlyExpansionPct: 1,
  newLogosPerMonth: 2,
  avgNewDealSize: 50_000, // 500 DKK
  pipelineConversionPct: 50,
};

// ─── projectScenario ─────────────────────────────────────────────

describe("projectScenario", () => {
  it("projects single month correctly", () => {
    const months = projectScenario(
      1_000_000, // 10,000 DKK MRR
      BASE_ASSUMPTIONS,
      1,
      "2026-03"
    );

    expect(months).toHaveLength(1);
    const m = months[0];
    expect(m.month).toBe("2026-04");
    expect(m.churnAmount).toBe(20_000); // 2% of 1M
    expect(m.expansionAmount).toBe(10_000); // 1% of 1M
    expect(m.newLogoAmount).toBe(100_000); // 2 × 50,000
    expect(m.pipelineAmount).toBe(0); // no pipeline deals
    // Net: 1,000,000 + 10,000 + 100,000 - 20,000 = 1,090,000
    expect(m.mrr).toBe(1_090_000);
    expect(m.arr).toBe(m.mrr * 12);
  });

  it("compounds churn/expansion on previous month MRR", () => {
    const months = projectScenario(
      1_000_000,
      BASE_ASSUMPTIONS,
      2,
      "2026-03"
    );

    expect(months).toHaveLength(2);
    // Month 2 uses month 1's MRR as base, not the original startMRR
    expect(months[1].churnAmount).toBe(
      Math.round(months[0].mrr * 0.02)
    );
  });

  it("includes pipeline deals in the matching month", () => {
    const deals = [
      { amount: 200_000, probability: 80, closeDate: "2026-05-15" },
    ];

    const months = projectScenario(
      1_000_000,
      BASE_ASSUMPTIONS,
      3,
      "2026-03",
      deals
    );

    // Month 2 (2026-05) should include pipeline
    const may = months.find((m) => m.month === "2026-05");
    expect(may).toBeDefined();
    // 200,000 × 50% conversion = 100,000
    expect(may!.pipelineAmount).toBe(100_000);
  });

  it("ignores pipeline deals without close dates", () => {
    const deals = [
      { amount: 200_000, probability: 80, closeDate: null },
    ];

    const months = projectScenario(
      1_000_000,
      BASE_ASSUMPTIONS,
      1,
      "2026-03",
      deals
    );

    expect(months[0].pipelineAmount).toBe(0);
  });

  it("never goes below zero MRR", () => {
    const highChurn: ForecastAssumptions = {
      ...BASE_ASSUMPTIONS,
      monthlyChurnPct: 100,
      monthlyExpansionPct: 0,
      newLogosPerMonth: 0,
    };

    const months = projectScenario(100_000, highChurn, 2, "2026-01");
    for (const m of months) {
      expect(m.mrr).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles zero start MRR", () => {
    const months = projectScenario(0, BASE_ASSUMPTIONS, 1, "2026-01");
    expect(months[0].churnAmount).toBe(0);
    expect(months[0].expansionAmount).toBe(0);
    // Only new logos contribute
    expect(months[0].newLogoAmount).toBe(100_000);
    expect(months[0].mrr).toBe(100_000);
  });
});

// ─── clampPct ────────────────────────────────────────────────────

describe("clampPct", () => {
  it("clamps to the 0–100 range", () => {
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(150)).toBe(100);
    expect(clampPct(42.5)).toBe(42.5);
  });
});

// ─── computePredictedAssumptions ─────────────────────────────────

describe("computePredictedAssumptions", () => {
  it("derives MRR-weighted rates from a trailing window (gross churn incl. contraction)", () => {
    // 7 rows → 6 month-transitions. Constant prior MRR of 1,000,000.
    const trailing: TrailingSnapshot[] = [
      "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
    ].map((m) =>
      snap(m, {
        mrr: 1_000_000,
        churned_mrr: 25_000,
        contraction_mrr: 5_000, // → 30,000 gross churn / 1,000,000 = 3.0%
        expansion_mrr: 15_000, // → 1.5%
        new_logos: 4,
        new_mrr: 240_000, // 240,000 / 4 = 60,000 avg deal
        arpa: 55_000,
      })
    );

    const { assumptions, sufficientHistory } = computePredictedAssumptions(trailing, 35);

    expect(sufficientHistory).toBe(true);
    expect(assumptions.scenario).toBe("predicted");
    expect(assumptions.monthlyChurnPct).toBeCloseTo(3.0, 6); // 2.0 without contraction
    expect(assumptions.monthlyExpansionPct).toBeCloseTo(1.5, 6);
    expect(assumptions.newLogosPerMonth).toBeCloseTo(4, 6);
    expect(assumptions.avgNewDealSize).toBe(60_000);
    expect(assumptions.pipelineConversionPct).toBe(35);
  });

  it("uses PAYING new logos (mrr>0) for the deal-size denominator", () => {
    // 5 rows → 4 transitions; 6 new logos/mo but only 3 paying; new_mrr 180,000/mo.
    const trailing: TrailingSnapshot[] = [
      "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
    ].map((m) => snap(m, { new_logos: 6, new_paying_logos: 3, new_mrr: 180_000 }));
    const { assumptions } = computePredictedAssumptions(trailing, 20);
    // 12 paying logos / 4 mo = 3/mo; 720,000 new_mrr / 12 paying = 60,000 (not /24 = 30,000)
    expect(assumptions.newLogosPerMonth).toBeCloseTo(3, 6);
    expect(assumptions.avgNewDealSize).toBe(60_000);
    // invariant: newLogosPerMonth × avgNewDealSize × months === Σ new_mrr
    expect(
      Math.round(assumptions.newLogosPerMonth * assumptions.avgNewDealSize * 4)
    ).toBe(720_000);
  });

  it("falls back to all new_logos when new_paying_logos is absent (un-backfilled)", () => {
    const trailing: TrailingSnapshot[] = [
      "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
    ].map((m) => snap(m, { new_logos: 6, new_mrr: 180_000 }));
    const { assumptions } = computePredictedAssumptions(trailing, 20);
    expect(assumptions.newLogosPerMonth).toBeCloseTo(6, 6);
    expect(assumptions.avgNewDealSize).toBe(30_000); // 720,000 / 24 all-logos
  });

  it("falls back to defaults with <3 months of history", () => {
    const trailing = [snap("2026-02", { arpa: 40_000 }), snap("2026-03", { arpa: 40_000 })];
    const { assumptions, sufficientHistory } = computePredictedAssumptions(trailing, null);

    expect(sufficientHistory).toBe(false);
    expect(assumptions.monthlyChurnPct).toBe(PREDICTED_FALLBACK.monthlyChurnPct);
    expect(assumptions.monthlyExpansionPct).toBe(PREDICTED_FALLBACK.monthlyExpansionPct);
    expect(assumptions.newLogosPerMonth).toBe(PREDICTED_FALLBACK.newLogosPerMonth);
    expect(assumptions.avgNewDealSize).toBe(40_000); // latest arpa
    expect(assumptions.pipelineConversionPct).toBe(20); // winRate null → 20
  });

  it("skips zero-prior-MRR months for rates without NaN", () => {
    const trailing: TrailingSnapshot[] = [
      snap("2026-01", { mrr: 0, arpa: 0 }), // tenant's first month
      snap("2026-02", { mrr: 1_000_000, new_logos: 3, new_mrr: 150_000 }),
      snap("2026-03", {
        mrr: 1_000_000,
        churned_mrr: 20_000,
        expansion_mrr: 5_000,
        new_logos: 1,
        new_mrr: 50_000,
      }),
    ];

    const { assumptions } = computePredictedAssumptions(trailing, 25);

    expect(Number.isNaN(assumptions.monthlyChurnPct)).toBe(false);
    // Only the 2026-03 transition has a positive prior MRR.
    expect(assumptions.monthlyChurnPct).toBeCloseTo(2.0, 6);
    expect(assumptions.monthlyExpansionPct).toBeCloseTo(0.5, 6);
    // Run-rate counts both transitions: (3+1) logos / 2 months = 2.
    expect(assumptions.newLogosPerMonth).toBeCloseTo(2, 6);
    expect(assumptions.avgNewDealSize).toBe(50_000); // 200,000 / 4
  });

  it("falls back avgNewDealSize to ARPA when no new logos closed", () => {
    const trailing = [
      snap("2026-01", { mrr: 1_000_000, arpa: 70_000 }),
      snap("2026-02", { mrr: 1_000_000, arpa: 70_000 }),
      snap("2026-03", { mrr: 1_000_000, arpa: 70_000 }),
    ];
    const { assumptions } = computePredictedAssumptions(trailing, 10);
    expect(assumptions.avgNewDealSize).toBe(70_000);
    expect(assumptions.newLogosPerMonth).toBe(0);
  });

  it("clamps an extreme churn rate to 100%", () => {
    const trailing = [
      snap("2026-01", { mrr: 100_000 }),
      snap("2026-02", { mrr: 100_000, churned_mrr: 200_000 }),
      snap("2026-03", { mrr: 100_000, churned_mrr: 200_000 }),
    ];
    const { assumptions } = computePredictedAssumptions(trailing, 50);
    expect(assumptions.monthlyChurnPct).toBe(100);
  });
});

// ─── deriveSuggestedBand ─────────────────────────────────────────

describe("deriveSuggestedBand", () => {
  const predicted: ForecastAssumptions = {
    scenario: "predicted",
    monthlyChurnPct: 4,
    monthlyExpansionPct: 2,
    newLogosPerMonth: 4,
    avgNewDealSize: 50_000,
    pipelineConversionPct: 30,
  };

  it("applies the band multipliers and passes deal economics through", () => {
    const worst = deriveSuggestedBand(predicted, "worst");
    expect(worst.monthlyChurnPct).toBeCloseTo(6, 6); // ×1.5
    expect(worst.monthlyExpansionPct).toBeCloseTo(1, 6); // ×0.5
    expect(worst.newLogosPerMonth).toBeCloseTo(2, 6); // ×0.5
    expect(worst.avgNewDealSize).toBe(50_000); // passthrough
    expect(worst.pipelineConversionPct).toBe(30); // passthrough

    const best = deriveSuggestedBand(predicted, "best");
    expect(best.monthlyChurnPct).toBeCloseTo(2, 6); // ×0.5
    expect(best.monthlyExpansionPct).toBeCloseTo(3.5, 6); // ×1.75
    expect(best.newLogosPerMonth).toBeCloseTo(7, 6); // ×1.75
  });

  it("orders projected MRR worst ≤ predicted ≤ better ≤ best", () => {
    const p: ForecastAssumptions = {
      scenario: "predicted",
      monthlyChurnPct: 3,
      monthlyExpansionPct: 1.5,
      newLogosPerMonth: 4,
      avgNewDealSize: 50_000,
      pipelineConversionPct: 20,
    };
    const worst = finalMrr(deriveSuggestedBand(p, "worst"));
    const predictedMrr = finalMrr(p);
    const better = finalMrr(deriveSuggestedBand(p, "better"));
    const best = finalMrr(deriveSuggestedBand(p, "best"));

    expect(worst).toBeLessThanOrEqual(predictedMrr);
    expect(predictedMrr).toBeLessThanOrEqual(better);
    expect(better).toBeLessThanOrEqual(best);
  });

  it("collapses all bands to predicted when there is no signal", () => {
    const flat: ForecastAssumptions = {
      scenario: "predicted",
      monthlyChurnPct: 0,
      monthlyExpansionPct: 0,
      newLogosPerMonth: 0,
      avgNewDealSize: 0,
      pipelineConversionPct: 0,
    };
    const p = finalMrr(flat);
    expect(finalMrr(deriveSuggestedBand(flat, "worst"))).toBe(p);
    expect(finalMrr(deriveSuggestedBand(flat, "better"))).toBe(p);
    expect(finalMrr(deriveSuggestedBand(flat, "best"))).toBe(p);
  });

  it("clamps a multiplied churn rate at 100%", () => {
    const high: ForecastAssumptions = { ...predicted, monthlyChurnPct: 80 };
    expect(deriveSuggestedBand(high, "worst").monthlyChurnPct).toBe(100); // 80 × 1.5 → clamp
  });

  it("rounds suggested values to one decimal (no noisy fractions in inputs)", () => {
    // Fractional predicted (e.g. 2.6667% churn) must not produce 4.00005-style noise.
    const fractional: ForecastAssumptions = {
      scenario: "predicted",
      monthlyChurnPct: 8 / 3, // 2.6666…
      monthlyExpansionPct: 1 / 3, // 0.3333…
      newLogosPerMonth: 7 / 3, // 2.3333…
      avgNewDealSize: 50_000,
      pipelineConversionPct: 30,
    };
    const oneDecimal = (v: number) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9;
    for (const s of ["worst", "better", "best"] as const) {
      const band = deriveSuggestedBand(fractional, s);
      expect(oneDecimal(band.monthlyChurnPct)).toBe(true);
      expect(oneDecimal(band.monthlyExpansionPct)).toBe(true);
      expect(oneDecimal(band.newLogosPerMonth)).toBe(true);
    }
  });
});
