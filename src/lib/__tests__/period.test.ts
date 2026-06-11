import { describe, it, expect } from "vitest";
import {
  monthPeriod,
  trailingPeriod,
  quarterPeriod,
  yearPeriod,
  periodToParams,
  periodFromParams,
  generatePeriodOptions,
  daysSince,
} from "../period";

// ─── daysSince ───────────────────────────────────────────────────

describe("daysSince", () => {
  const now = Date.parse("2026-01-11T00:00:00Z");

  it("counts whole days from an ISO date up until now", () => {
    expect(daysSince("2026-01-01T00:00:00Z", now)).toBe(10);
  });

  it("floors partial days", () => {
    expect(daysSince("2026-01-01T00:00:00Z", Date.parse("2026-01-11T23:00:00Z"))).toBe(10);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince(undefined, now)).toBeNull();
    expect(daysSince("", now)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(daysSince("not-a-date", now)).toBeNull();
  });

  it("clamps future dates to 0", () => {
    expect(daysSince("2026-12-31T00:00:00Z", now)).toBe(0);
  });
});

// ─── monthPeriod ─────────────────────────────────────────────────

describe("monthPeriod", () => {
  it("creates a single-month descriptor", () => {
    const p = monthPeriod("2026-03");
    expect(p.type).toBe("month");
    expect(p.startMonth).toBe("2026-03");
    expect(p.endMonth).toBe("2026-03");
    expect(p.label).toContain("Mar");
    expect(p.label).toContain("2026");
  });
});

// ─── trailingPeriod ──────────────────────────────────────────────

describe("trailingPeriod", () => {
  it("builds a trailing 3M period", () => {
    const p = trailingPeriod(3, "2026-03");
    expect(p.type).toBe("trailing");
    expect(p.startMonth).toBe("2026-01");
    expect(p.endMonth).toBe("2026-03");
    expect(p.label).toBe("Trailing 3M");
  });

  it("handles year boundary (trailing from Feb)", () => {
    const p = trailingPeriod(3, "2026-02");
    expect(p.startMonth).toBe("2025-12");
    expect(p.endMonth).toBe("2026-02");
  });

  it("builds trailing 12M", () => {
    const p = trailingPeriod(12, "2026-06");
    expect(p.startMonth).toBe("2025-07");
    expect(p.endMonth).toBe("2026-06");
  });
});

// ─── quarterPeriod ───────────────────────────────────────────────

describe("quarterPeriod", () => {
  it("builds Q1", () => {
    const p = quarterPeriod(1, 2026);
    expect(p.type).toBe("quarter");
    expect(p.startMonth).toBe("2026-01");
    expect(p.endMonth).toBe("2026-03");
    expect(p.label).toBe("Q1 2026");
  });

  it("builds Q4", () => {
    const p = quarterPeriod(4, 2025);
    expect(p.startMonth).toBe("2025-10");
    expect(p.endMonth).toBe("2025-12");
    expect(p.label).toBe("Q4 2025");
  });
});

// ─── yearPeriod ──────────────────────────────────────────────────

describe("yearPeriod", () => {
  it("spans full year", () => {
    const p = yearPeriod(2025);
    expect(p.type).toBe("year");
    expect(p.startMonth).toBe("2025-01");
    expect(p.endMonth).toBe("2025-12");
    expect(p.label).toBe("2025");
  });
});

// ─── periodToParams / periodFromParams ───────────────────────────

describe("periodToParams", () => {
  it("serializes month as ?month=", () => {
    const params = periodToParams(monthPeriod("2026-03"));
    expect(params).toEqual({ month: "2026-03" });
  });

  it("serializes range as ?start=&end=", () => {
    const params = periodToParams(trailingPeriod(3, "2026-03"));
    expect(params).toEqual({ start: "2026-01", end: "2026-03" });
  });
});

describe("periodFromParams", () => {
  it("parses range params (start + end)", () => {
    const params = new URLSearchParams("start=2026-01&end=2026-03");
    const p = periodFromParams(params);
    expect(p.startMonth).toBe("2026-01");
    expect(p.endMonth).toBe("2026-03");
    // Jan-Mar is a quarter boundary, so inferred as Q1
    expect(p.type).toBe("quarter");
  });

  it("range params take priority over month param", () => {
    const params = new URLSearchParams(
      "month=2026-06&start=2026-01&end=2026-03"
    );
    const p = periodFromParams(params);
    expect(p.startMonth).toBe("2026-01");
    expect(p.endMonth).toBe("2026-03");
  });

  it("parses single month param", () => {
    const params = new URLSearchParams("month=2026-03");
    const p = periodFromParams(params);
    expect(p.type).toBe("month");
    expect(p.startMonth).toBe("2026-03");
  });

  it("falls back to current month when nothing valid", () => {
    const p = periodFromParams(new URLSearchParams());
    expect(p.type).toBe("month");
    expect(p.startMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it("ignores invalid date formats", () => {
    const params = new URLSearchParams("month=not-a-date");
    const p = periodFromParams(params);
    // Falls back to current month
    expect(p.type).toBe("month");
  });

  it("infers year type for Jan-Dec range", () => {
    const params = new URLSearchParams("start=2025-01&end=2025-12");
    const p = periodFromParams(params);
    expect(p.type).toBe("year");
    expect(p.label).toBe("2025");
  });

  it("infers quarter type for 3-month boundary range", () => {
    const params = new URLSearchParams("start=2026-04&end=2026-06");
    const p = periodFromParams(params);
    expect(p.type).toBe("quarter");
    expect(p.label).toBe("Q2 2026");
  });
});

// ─── generatePeriodOptions ───────────────────────────────────────

describe("generatePeriodOptions", () => {
  it("generates all option groups", () => {
    const opts = generatePeriodOptions("2026-04");
    expect(opts.months.length).toBe(24);
    expect(opts.trailing.length).toBe(3); // 3M, 6M, 12M
    expect(opts.quarters.length).toBeGreaterThan(0);
    expect(opts.years.length).toBe(3);
  });

  it("skips future quarters", () => {
    const opts = generatePeriodOptions("2026-04");
    for (const q of opts.quarters) {
      expect(q.endMonth <= "2026-04").toBe(true);
    }
  });

  it("first month is the current month", () => {
    const opts = generatePeriodOptions("2026-04");
    expect(opts.months[0].startMonth).toBe("2026-04");
  });
});
