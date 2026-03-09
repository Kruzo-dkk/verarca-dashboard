import type { PeriodDescriptor } from "@/lib/types/period";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return YYYY-MM for N months before the given month. */
function monthsAgo(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Current month as YYYY-MM. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Format a YYYY-MM string as "Mar 2026". */
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Period resolution
// ---------------------------------------------------------------------------

/**
 * Build a single-month PeriodDescriptor.
 */
export function monthPeriod(month: string): PeriodDescriptor {
  return {
    type: "month",
    label: formatMonthLabel(month),
    startMonth: month,
    endMonth: month,
  };
}

/**
 * Build a trailing-N-month PeriodDescriptor ending at the given month.
 * E.g. trailing 3M from 2026-03 = { start: 2026-01, end: 2026-03 }
 */
export function trailingPeriod(
  months: number,
  endMonth?: string
): PeriodDescriptor {
  const end = endMonth ?? currentMonth();
  const start = monthsAgo(end, months - 1);
  return {
    type: "trailing",
    label: `Trailing ${months}M`,
    startMonth: start,
    endMonth: end,
  };
}

/**
 * Build a quarterly PeriodDescriptor.
 * quarter = 1..4, year = 2025, 2026, etc.
 */
export function quarterPeriod(
  quarter: number,
  year: number
): PeriodDescriptor {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  return {
    type: "quarter",
    label: `Q${quarter} ${year}`,
    startMonth: `${year}-${String(startMonth).padStart(2, "0")}`,
    endMonth: `${year}-${String(endMonth).padStart(2, "0")}`,
  };
}

/**
 * Build a full-year PeriodDescriptor.
 */
export function yearPeriod(year: number): PeriodDescriptor {
  return {
    type: "year",
    label: `${year}`,
    startMonth: `${year}-01`,
    endMonth: `${year}-12`,
  };
}

// ---------------------------------------------------------------------------
// URL serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a PeriodDescriptor into URL search params.
 * Single months: ?month=2026-03
 * Ranges: ?start=2026-01&end=2026-03
 */
export function periodToParams(
  period: PeriodDescriptor
): Record<string, string> {
  if (period.type === "month") {
    return { month: period.startMonth };
  }
  return { start: period.startMonth, end: period.endMonth };
}

/**
 * Deserialize URL search params into a PeriodDescriptor.
 * Falls back to the current month if nothing valid is found.
 */
export function periodFromParams(
  params: URLSearchParams
): PeriodDescriptor {
  const start = params.get("start");
  const end = params.get("end");
  const month = params.get("month");

  // Range params take priority
  if (start && end && /^\d{4}-\d{2}$/.test(start) && /^\d{4}-\d{2}$/.test(end)) {
    return {
      type: inferPeriodType(start, end),
      label: inferLabel(start, end),
      startMonth: start,
      endMonth: end,
    };
  }

  // Single month
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return monthPeriod(month);
  }

  // Default: current month
  return monthPeriod(currentMonth());
}

/** Infer the period type from a start/end range. */
function inferPeriodType(start: string, end: string): "trailing" | "quarter" | "year" {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  // Full year
  if (sm === 1 && em === 12 && sy === ey) return "year";

  // Quarter: same year, 3 months, starts on quarter boundary
  if (sy === ey && em - sm === 2 && (sm - 1) % 3 === 0) return "quarter";

  return "trailing";
}

/** Build a label for a start/end range. */
function inferLabel(start: string, end: string): string {
  const type = inferPeriodType(start, end);
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  if (type === "year") return `${sy}`;
  if (type === "quarter") return `Q${Math.ceil(sm / 3)} ${sy}`;

  // Trailing: compute month span
  const months = (ey - sy) * 12 + (em - sm) + 1;
  return `Trailing ${months}M`;
}

// ---------------------------------------------------------------------------
// Generate period options for the selector
// ---------------------------------------------------------------------------

/**
 * Generate all period options for the dropdown grouped by type.
 * Returns: { months, trailing, quarters, years }
 */
export function generatePeriodOptions(now?: string): {
  months: PeriodDescriptor[];
  trailing: PeriodDescriptor[];
  quarters: PeriodDescriptor[];
  years: PeriodDescriptor[];
} {
  const current = now ?? currentMonth();
  const [currentYear] = current.split("-").map(Number);

  // Last 24 individual months
  const months: PeriodDescriptor[] = [];
  for (let i = 0; i < 24; i++) {
    const m = monthsAgo(current, i);
    months.push(monthPeriod(m));
  }

  // Trailing periods
  const trailing = [
    trailingPeriod(3, current),
    trailingPeriod(6, current),
    trailingPeriod(12, current),
  ];

  // Quarters for last 2 years
  const quarters: PeriodDescriptor[] = [];
  for (const year of [currentYear, currentYear - 1]) {
    for (const q of [4, 3, 2, 1]) {
      // Skip future quarters
      const qEnd = `${year}-${String(q * 3).padStart(2, "0")}`;
      if (qEnd <= current) {
        quarters.push(quarterPeriod(q, year));
      }
    }
  }

  // Full years
  const years: PeriodDescriptor[] = [];
  for (let y = currentYear - 1; y >= currentYear - 3; y--) {
    years.push(yearPeriod(y));
  }

  return { months, trailing, quarters, years };
}
