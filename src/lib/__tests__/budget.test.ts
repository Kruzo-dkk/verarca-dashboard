import { describe, it, expect } from "vitest";
import {
  addMonths,
  fiscalYearEndYear,
  fiscalYearLabel,
  fiscalYearMonths,
  fiscalQuarter,
  fiscalQuarterLabel,
  fiscalQuarterMonths,
  fiscalYTDMonths,
  budgetMonthRange,
  rollupValues,
  attainmentPct,
  prefillBudget,
  BUDGET_METRICS,
} from "../budget";

// ─── Month arithmetic ────────────────────────────────────────────

describe("addMonths", () => {
  it("adds within a year", () => {
    expect(addMonths("2026-01", 5)).toBe("2026-06");
  });
  it("rolls over the year boundary", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });
  it("goes backwards", () => {
    expect(addMonths("2026-02", -3)).toBe("2025-11");
  });
});

// ─── Fiscal year (1 Aug – 31 Jul) ────────────────────────────────

describe("fiscal year (Aug–Jul)", () => {
  it("August starts the next-ending fiscal year", () => {
    expect(fiscalYearEndYear("2025-08")).toBe(2026);
  });
  it("July ends the same-year fiscal year", () => {
    expect(fiscalYearEndYear("2026-07")).toBe(2026);
  });
  it("Aug 2025 and Jul 2026 are the same fiscal year", () => {
    expect(fiscalYearEndYear("2025-08")).toBe(fiscalYearEndYear("2026-07"));
  });
  it("labels by start/end short years", () => {
    expect(fiscalYearLabel("2026-06")).toBe("FY25/26");
    expect(fiscalYearLabel("2025-08")).toBe("FY25/26");
    expect(fiscalYearLabel("2026-08")).toBe("FY26/27");
  });
  it("enumerates 12 months Aug→Jul", () => {
    const months = fiscalYearMonths("2026-06");
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-08");
    expect(months[11]).toBe("2026-07");
  });
});

// ─── Fiscal quarters (Q1 Aug-Oct … Q4 May-Jul) ───────────────────

describe("fiscal quarters", () => {
  it("Aug = Q1, Jul = Q4", () => {
    expect(fiscalQuarter("2025-08")).toBe(1);
    expect(fiscalQuarter("2026-07")).toBe(4);
  });
  it("June is Q4", () => {
    expect(fiscalQuarter("2026-06")).toBe(4);
    expect(fiscalQuarterLabel("2026-06")).toBe("Q4 FY25/26");
  });
  it("January is Q2", () => {
    expect(fiscalQuarter("2026-01")).toBe(2);
  });
  it("returns the 3 months of the quarter", () => {
    expect(fiscalQuarterMonths("2026-06")).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(fiscalQuarterMonths("2025-09")).toEqual(["2025-08", "2025-09", "2025-10"]);
  });
});

// ─── YTD + forward range ─────────────────────────────────────────

describe("fiscal YTD + budget range", () => {
  it("YTD runs Aug → the month inclusive", () => {
    const ytd = fiscalYTDMonths("2026-06");
    expect(ytd[0]).toBe("2025-08");
    expect(ytd[ytd.length - 1]).toBe("2026-06");
    expect(ytd).toHaveLength(11); // Aug..Jun
  });
  it("budget range covers start..start+ahead inclusive (2 years = 24)", () => {
    const range = budgetMonthRange("2026-06", 24);
    expect(range).toHaveLength(25);
    expect(range[0]).toBe("2026-06");
    expect(range[24]).toBe("2028-06");
  });
});

// ─── Roll-ups ────────────────────────────────────────────────────

describe("rollupValues", () => {
  it("sums, skipping nulls", () => {
    expect(rollupValues([10, null, 20, 30], "sum")).toBe(60);
  });
  it("averages present values (2dp)", () => {
    expect(rollupValues([80, 90, null], "average")).toBe(85);
  });
  it("endOfPeriod takes the last present value", () => {
    expect(rollupValues([6, 7, null], "endOfPeriod")).toBe(7);
    expect(rollupValues([6, null, null], "endOfPeriod")).toBe(6);
  });
  it("returns null when nothing is present", () => {
    expect(rollupValues([null, null], "sum")).toBeNull();
    expect(rollupValues([], "average")).toBeNull();
  });
});

describe("attainmentPct", () => {
  it("actual / budget × 100 (1dp)", () => {
    expect(attainmentPct(94, 100)).toBe(94);
    expect(attainmentPct(166, 170)).toBe(97.6);
  });
  it("null when budget is missing or zero, or actual missing", () => {
    expect(attainmentPct(50, null)).toBeNull();
    expect(attainmentPct(50, 0)).toBeNull();
    expect(attainmentPct(null, 100)).toBeNull();
  });
});

// ─── Prefill ─────────────────────────────────────────────────────

describe("prefillBudget", () => {
  it("carries non-null values forward", () => {
    expect(prefillBudget({ monthly_burn: 120, gross_margin_pct: 85, target_new_logos: null })).toEqual({
      monthly_burn: 120,
      gross_margin_pct: 85,
    });
  });
  it("returns an empty map when nothing to carry", () => {
    expect(prefillBudget({ a: null, b: null })).toEqual({});
  });
});

// ─── Metric registry ─────────────────────────────────────────────

describe("BUDGET_METRICS registry", () => {
  it("has unique keys", () => {
    const keys = BUDGET_METRICS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("covers all four sections", () => {
    const sections = new Set(BUDGET_METRICS.map((m) => m.section));
    expect(sections).toEqual(
      new Set(["Finance", "Acquisition", "Headcount", "Sales Targets"])
    );
  });
  it("every metric has a rollup kind and an actual source", () => {
    for (const m of BUDGET_METRICS) {
      expect(["sum", "average", "endOfPeriod"]).toContain(m.rollup);
      expect(["settings", "synced", "none"]).toContain(m.actual);
    }
  });
  it("every kr metric is stored in øre (ore=true) so it matches the actuals", () => {
    // settings + snapshots store all monetary values in øre; the grid divides by
    // 100 for display and multiplies on save. A kr metric flagged ore=false would
    // be off by 100×.
    for (const m of BUDGET_METRICS) {
      if (m.unit === "kr") expect(m.ore).toBe(true);
      else expect(m.ore).toBe(false);
    }
  });
});
