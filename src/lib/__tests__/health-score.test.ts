import { describe, it, expect } from "vitest";
import { computeHealthScore, type HealthScoreInput } from "../health-score";

function baseInput(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
  return {
    mrrHistory: [
      { month: "2026-03", mrr: 100_000 },
      { month: "2026-02", mrr: 95_000 },
      { month: "2026-01", mrr: 90_000 },
    ],
    tier: "Managed",
    monthsAsCustomer: 24,
    daysSinceLastActivity: 3,
    openTickets: 0,
    ...overrides,
  };
}

// ─── Overall scoring ─────────────────────────────────────────────

describe("computeHealthScore", () => {
  it("returns healthy for ideal customer", () => {
    const result = computeHealthScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.label).toBe("healthy");
  });

  it("returns at_risk for worst case", () => {
    const result = computeHealthScore(
      baseInput({
        mrrHistory: [
          { month: "2026-03", mrr: 50_000 },
          { month: "2026-02", mrr: 80_000 },
          { month: "2026-01", mrr: 100_000 },
        ],
        tier: null,
        monthsAsCustomer: 2,
        daysSinceLastActivity: 90,
        openTickets: 10,
      })
    );
    expect(result.score).toBeLessThan(40);
    expect(result.label).toBe("at_risk");
  });

  it("score is between 0 and 100", () => {
    const result = computeHealthScore(baseInput());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  // ─── MRR Trend (30%) ────────────────────────────────────────

  it("scores MRR expanding when >5% growth", () => {
    const result = computeHealthScore(
      baseInput({
        mrrHistory: [
          { month: "2026-03", mrr: 120_000 },
          { month: "2026-01", mrr: 100_000 },
        ],
      })
    );
    expect(result.factors).toContain("MRR expanding");
  });

  it("scores MRR flat for small changes", () => {
    const result = computeHealthScore(
      baseInput({
        mrrHistory: [
          { month: "2026-03", mrr: 102_000 },
          { month: "2026-01", mrr: 100_000 },
        ],
      })
    );
    expect(result.factors).toContain("MRR flat");
  });

  it("scores MRR declining for >5% drop", () => {
    const result = computeHealthScore(
      baseInput({
        mrrHistory: [
          { month: "2026-03", mrr: 90_000 },
          { month: "2026-01", mrr: 100_000 },
        ],
      })
    );
    expect(result.factors).toContain("MRR declining");
  });

  it("defaults to 50 with insufficient MRR history", () => {
    const result = computeHealthScore(
      baseInput({ mrrHistory: [{ month: "2026-03", mrr: 100_000 }] })
    );
    expect(result.factors).toContain("Insufficient MRR history");
  });

  // ─── Activity Recency (25%) ─────────────────────────────────

  it("flags no activity in 30+ days", () => {
    const result = computeHealthScore(
      baseInput({ daysSinceLastActivity: 45 })
    );
    expect(result.factors).toContain("No activity in 30+ days");
  });

  it("flags no activity in 60+ days", () => {
    const result = computeHealthScore(
      baseInput({ daysSinceLastActivity: 90 })
    );
    expect(result.factors).toContain("No activity in 60+ days");
  });

  it("handles null activity data", () => {
    const result = computeHealthScore(
      baseInput({ daysSinceLastActivity: null })
    );
    expect(result.factors).toContain("No activity data");
  });

  // ─── Tenure (15%) ───────────────────────────────────────────

  it("flags new customers (<6 months)", () => {
    const result = computeHealthScore(baseInput({ monthsAsCustomer: 3 }));
    expect(result.factors).toContain("New customer (<6 months)");
  });

  // ─── Tickets (15%) ──────────────────────────────────────────

  it("reports open ticket count", () => {
    const result = computeHealthScore(baseInput({ openTickets: 2 }));
    expect(result.factors).toContain("2 open ticket(s)");
  });

  it("flags high ticket burden", () => {
    const result = computeHealthScore(baseInput({ openTickets: 8 }));
    expect(result.factors).toContain("8 open tickets — high burden");
  });

  // ─── Tier (15%) ─────────────────────────────────────────────

  it("flags missing service tier", () => {
    const result = computeHealthScore(baseInput({ tier: null }));
    expect(result.factors).toContain("No service tier assigned");
  });
});

// ─── MRR-trend baseline (newly-joined customers) ─────────────────

describe("computeHealthScore — MRR baseline ignores leading zero-MRR months", () => {
  it("scores a recently-joined, now-growing customer as expanding (not flat)", () => {
    // newest-first; the oldest months are 0 because the customer joined later.
    const result = computeHealthScore({
      mrrHistory: [
        { month: "2026-06", mrr: 30_000 },
        { month: "2026-05", mrr: 20_000 },
        { month: "2026-04", mrr: 10_000 },
        { month: "2026-03", mrr: 0 },
        { month: "2026-02", mrr: 0 },
        { month: "2026-01", mrr: 0 },
      ],
      tier: "Managed",
      monthsAsCustomer: 3,
      daysSinceLastActivity: null,
      openTickets: 0,
    });
    expect(result.factors).toContain("MRR expanding");
  });
});
