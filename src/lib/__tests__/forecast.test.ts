import { describe, it, expect } from "vitest";
import { projectScenario, type ForecastAssumptions } from "../forecast";

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
