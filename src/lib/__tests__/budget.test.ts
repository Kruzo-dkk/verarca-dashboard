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
  signedVariancePct,
  varianceBucket,
  heatScale,
  monthExceptions,
  fillRightTargets,
  fillDownTargets,
  parseClipboard,
  flattenClipboard,
  planPaste,
  type PasteCandidate,
  projectCashRunway,
  monthsOfRunway,
  cashZeroMonth,
  suggestBudget,
  type SuggestLookup,
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


// ─── Variance / heat / exceptions ────────────────────────────────

const metricByKey = (k: string) => BUDGET_METRICS.find((m) => m.key === k)!;

describe("BUDGET_METRICS goodDirection", () => {
  it("assigns a goodDirection to every metric", () => {
    for (const m of BUDGET_METRICS) {
      expect(["higher", "lower", "neutral"]).toContain(m.goodDirection);
    }
  });
  it("burn/COGS/CAC are lower-is-better; MRR/margin/activity higher; headcount neutral", () => {
    expect(metricByKey("monthly_burn").goodDirection).toBe("lower");
    expect(metricByKey("total_cac").goodDirection).toBe("lower");
    expect(metricByKey("gross_margin_pct").goodDirection).toBe("higher");
    expect(metricByKey("target_new_mrr").goodDirection).toBe("higher");
    expect(metricByKey("employee_count").goodDirection).toBe("neutral");
  });
});

describe("signedVariancePct", () => {
  it("is positive when actual exceeds budget", () => {
    expect(signedVariancePct(110, 100)).toBe(10);
  });
  it("is negative when actual is below budget", () => {
    expect(signedVariancePct(80, 100)).toBe(-20);
  });
  it("returns null for missing/zero budget or missing actual", () => {
    expect(signedVariancePct(100, 0)).toBeNull();
    expect(signedVariancePct(100, null)).toBeNull();
    expect(signedVariancePct(null, 100)).toBeNull();
  });
});

describe("varianceBucket", () => {
  it("higher-is-better: above tolerance = good, below = bad/warn", () => {
    expect(varianceBucket("higher", 15)).toBe("good");
    expect(varianceBucket("higher", -15)).toBe("bad");
    expect(varianceBucket("higher", -5)).toBe("warn");
    expect(varianceBucket("higher", 5)).toBe("neutral"); // on/ahead within tol
  });
  it("lower-is-better flips: under budget = good, over = bad/warn", () => {
    expect(varianceBucket("lower", -15)).toBe("good");
    expect(varianceBucket("lower", 15)).toBe("bad");
    expect(varianceBucket("lower", 5)).toBe("warn");
  });
  it("neutral direction or null variance is neutral", () => {
    expect(varianceBucket("neutral", 50)).toBe("neutral");
    expect(varianceBucket("higher", null)).toBe("neutral");
  });
  it("respects a custom tolerance", () => {
    expect(varianceBucket("higher", 8, 5)).toBe("good");
    expect(varianceBucket("higher", 8, 20)).toBe("neutral");
  });
});

describe("heatScale", () => {
  it("neutral bucket → no tint", () => {
    expect(heatScale("neutral", 50).opacity).toBe(0);
    expect(heatScale("higher", null).opacity).toBe(0);
    expect(heatScale("higher", 3).opacity).toBe(0);
  });
  it("opacity grows with magnitude and caps at 0.45", () => {
    const small = heatScale("lower", 15).opacity;
    const big = heatScale("lower", 120).opacity;
    expect(small).toBeGreaterThan(0);
    expect(big).toBe(0.45);
    expect(big).toBeGreaterThan(small);
  });
  it("carries the direction-aware bucket", () => {
    expect(heatScale("lower", -30).bucket).toBe("good");
    expect(heatScale("higher", -30).bucket).toBe("bad");
  });
});

describe("monthExceptions", () => {
  it("returns only off-plan metrics, worst first (bad before warn, then |variance|)", () => {
    const rows = [
      { metric: metricByKey("monthly_burn"), budget: 100, actual: 130 },    // +30% → bad
      { metric: metricByKey("target_new_mrr"), budget: 100, actual: 95 },   // -5%  → warn
      { metric: metricByKey("gross_margin_pct"), budget: 50, actual: 70 },  // +40% → good (omit)
      { metric: metricByKey("target_new_logos"), budget: 100, actual: 60 }, // -40% → bad
      { metric: metricByKey("employee_count"), budget: 10, actual: 4 },     // neutral (omit)
    ];
    const ex = monthExceptions(rows);
    expect(ex.map((e) => e.metricKey)).toEqual([
      "target_new_logos",
      "monthly_burn",
      "target_new_mrr",
    ]);
    expect(ex[0].severity).toBe("bad");
    expect(ex[2].severity).toBe("warn");
  });
  it("is empty when everything is on or ahead of plan", () => {
    const rows = [
      { metric: metricByKey("monthly_burn"), budget: 100, actual: 90 },     // under → good
      { metric: metricByKey("target_new_mrr"), budget: 100, actual: 105 },  // ahead → neutral
    ];
    expect(monthExceptions(rows)).toEqual([]);
  });
});


// ─── Fill & paste ────────────────────────────────────────────────

describe("fillRightTargets", () => {
  it("returns editable months strictly to the right", () => {
    const months = ["2026-01", "2026-02", "2026-03", "2026-04"];
    expect(fillRightTargets("2026-02", months)).toEqual(["2026-03", "2026-04"]);
  });
  it("is empty at the right edge", () => {
    expect(fillRightTargets("2026-04", ["2026-03", "2026-04"])).toEqual([]);
  });
});

describe("fillDownTargets", () => {
  it("returns same-section metrics below the anchor", () => {
    expect(fillDownTargets("cac_outbound", BUDGET_METRICS)).toEqual([
      "cac_partner",
      "cac_inbound",
    ]);
    expect(fillDownTargets("gross_margin_pct", BUDGET_METRICS)).toEqual([
      "monthly_cogs",
      "monthly_burn",
    ]);
  });
  it("is empty at a section's last metric or for a lone metric", () => {
    expect(fillDownTargets("target_calls", BUDGET_METRICS)).toEqual([]);
    expect(fillDownTargets("employee_count", BUDGET_METRICS)).toEqual([]);
  });
  it("is empty for an unknown key", () => {
    expect(fillDownTargets("nope", BUDGET_METRICS)).toEqual([]);
  });
});

describe("parseClipboard", () => {
  it("splits a single column", () => {
    expect(parseClipboard("1\n2\n3")).toEqual([["1"], ["2"], ["3"]]);
  });
  it("splits rows and tab columns and drops one trailing newline", () => {
    expect(parseClipboard("1\t2\r\n3\t4\n")).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
  it("keeps a single value", () => {
    expect(parseClipboard("5")).toEqual([["5"]]);
  });
});

describe("flattenClipboard", () => {
  it("a lone row pastes right", () => {
    expect(flattenClipboard([["1", "2", "3"]])).toEqual({
      values: [1, 2, 3],
      orientation: "right",
    });
  });
  it("a taller block pastes down its first column", () => {
    expect(flattenClipboard([["1", "x"], ["2", "y"], ["", "z"]])).toEqual({
      values: [1, 2, null],
      orientation: "down",
    });
  });
});

describe("planPaste", () => {
  const C = (
    month: string,
    metricKey: string,
    editable: boolean
  ): PasteCandidate => ({ month, metricKey, field: "budget", editable });

  it("zips values onto consecutive editable cells", () => {
    const candidates = [
      C("2026-01", "a", true),
      C("2026-02", "a", true),
      C("2026-03", "a", true),
    ];
    expect(planPaste([10, 20, 30], candidates)).toEqual([
      { month: "2026-01", metricKey: "a", field: "budget", value: 10 },
      { month: "2026-02", metricKey: "a", field: "budget", value: 20 },
      { month: "2026-03", metricKey: "a", field: "budget", value: 30 },
    ]);
  });
  it("skips non-editable cells without consuming a value", () => {
    const candidates = [
      C("2026-01", "a", true),
      C("2026-02", "a", false), // synced/future → skipped
      C("2026-03", "a", true),
    ];
    expect(planPaste([10, 20], candidates).map((t) => [t.month, t.value])).toEqual([
      ["2026-01", 10],
      ["2026-03", 20],
    ]);
  });
  it("stops when values run out", () => {
    const candidates = [C("2026-01", "a", true), C("2026-02", "a", true)];
    expect(planPaste([99], candidates)).toHaveLength(1);
  });
});


// ─── Cash runway ─────────────────────────────────────────────────

describe("projectCashRunway", () => {
  it("subtracts each month's burn, starting at the full balance", () => {
    const series = projectCashRunway(1000, "2026-01", { "2026-01": 200, "2026-02": 300 }, 3);
    expect(series).toEqual([
      { month: "2026-01", cash: 1000 },
      { month: "2026-02", cash: 800 },
      { month: "2026-03", cash: 500 },
      { month: "2026-04", cash: 500 }, // no burn entry → 0
    ]);
  });
  it("satisfies cash[m] = startCash − Σ burn[start..m-1]", () => {
    const burn = { "2026-01": 100, "2026-02": 100, "2026-03": 100 };
    const series = projectCashRunway(1000, "2026-01", burn, 3);
    expect(series[3].cash).toBe(1000 - 300);
  });
});

describe("cashZeroMonth", () => {
  it("returns the first month the balance hits zero or below", () => {
    const series = projectCashRunway(500, "2026-01", { "2026-01": 300, "2026-02": 300 }, 3);
    expect(cashZeroMonth(series)).toBe("2026-03"); // 500 → 200 → -100
  });
  it("returns null when cash never runs out", () => {
    const series = projectCashRunway(1000, "2026-01", { "2026-01": 100 }, 3);
    expect(cashZeroMonth(series)).toBeNull();
  });
});

describe("monthsOfRunway", () => {
  it("is cash ÷ avg burn (1 dp)", () => {
    expect(monthsOfRunway(1000, 200)).toBe(5);
    expect(monthsOfRunway(1500, 400)).toBe(3.8);
  });
  it("is null when not burning (infinite runway)", () => {
    expect(monthsOfRunway(1000, 0)).toBeNull();
    expect(monthsOfRunway(1000, -50)).toBeNull();
  });
});


// ─── Budget suggestions ──────────────────────────────────────────

describe("suggestBudget", () => {
  // Build a lookup from {month: {key: value}} maps.
  const lk = (
    actuals: Record<string, Record<string, number>>,
    budgets: Record<string, Record<string, number>> = {}
  ): SuggestLookup => ({
    actual: (k, m) => actuals[m]?.[k] ?? null,
    budget: (k, m) => budgets[m]?.[k] ?? null,
  });
  const mNewMrr = metricByKey("target_new_mrr"); // sum, synced
  const mBurn = metricByKey("monthly_burn"); // sum, settings
  const mMargin = metricByKey("gross_margin_pct"); // average, settings
  const mHead = metricByKey("employee_count"); // endOfPeriod, settings

  it("averages trailing synced actuals for a sales metric", () => {
    const actuals = {
      "2026-03": { target_new_mrr: 100 },
      "2026-04": { target_new_mrr: 200 },
      "2026-05": { target_new_mrr: 300 },
    };
    expect(suggestBudget(mNewMrr, "2026-06", lk(actuals))).toBe(200);
  });

  it("falls back to prior budget when a finance actual is missing", () => {
    const actuals = { "2026-05": { monthly_burn: 120 } }; // only one actual
    const budgets = {
      "2026-03": { monthly_burn: 60 },
      "2026-04": { monthly_burn: 60 },
    };
    // values: 120 (actual May) + 60 + 60 (budget Apr/Mar) → mean 80
    expect(suggestBudget(mBurn, "2026-06", lk(actuals, budgets))).toBe(80);
  });

  it("averages a percentage metric", () => {
    const actuals = {
      "2026-03": { gross_margin_pct: 40 },
      "2026-04": { gross_margin_pct: 50 },
      "2026-05": { gross_margin_pct: 60 },
    };
    expect(suggestBudget(mMargin, "2026-06", lk(actuals))).toBe(50);
  });

  it("uses the most recent value for an endOfPeriod metric", () => {
    const actuals = {
      "2026-04": { employee_count: 4 },
      "2026-05": { employee_count: 5 },
    };
    expect(suggestBudget(mHead, "2026-06", lk(actuals))).toBe(5);
  });

  it("returns null when there is nothing to go on", () => {
    expect(suggestBudget(mNewMrr, "2026-06", lk({}))).toBeNull();
  });
});
