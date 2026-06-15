/**
 * Budgeting model for the Monthly Input tool.
 *
 * Verarca's fiscal year runs 1 Aug – 31 Jul. A fiscal year is identified by its
 * END calendar year (Aug 2025 – Jul 2026 = "FY25/26"). Fiscal quarters:
 *   Q1 Aug-Oct · Q2 Nov-Jan · Q3 Feb-Apr · Q4 May-Jul.
 *
 * Every metric has a Budget (planned, editable up to 24 months ahead) and an
 * Actual (finance = entered in `settings`; sales = synced from snapshots).
 * Pure functions here drive the grid's period columns, roll-ups, attainment and
 * prefill — all unit-tested, no I/O.
 */

export const FISCAL_START_MONTH = 8; // August

// ─── Month arithmetic (YYYY-MM) ──────────────────────────────────

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Fiscal year ─────────────────────────────────────────────────

/** Calendar year in which the fiscal year containing `month` ends (31 Jul). */
export function fiscalYearEndYear(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= FISCAL_START_MONTH ? y + 1 : y;
}

/** e.g. "FY25/26" for any month in Aug 2025 – Jul 2026. */
export function fiscalYearLabel(month: string): string {
  const end = fiscalYearEndYear(month);
  return `FY${String(end - 1).slice(-2)}/${String(end).slice(-2)}`;
}

/** The 12 months of the fiscal year containing `month`, Aug → Jul. */
export function fiscalYearMonths(month: string): string[] {
  const end = fiscalYearEndYear(month);
  const start = `${end - 1}-08`;
  return Array.from({ length: 12 }, (_, i) => addMonths(start, i));
}

// ─── Fiscal quarters ─────────────────────────────────────────────

/** Fiscal quarter 1–4 (Q1 = Aug-Oct … Q4 = May-Jul). */
export function fiscalQuarter(month: string): number {
  const [, m] = month.split("-").map(Number);
  const idx = (m - FISCAL_START_MONTH + 12) % 12; // 0..11, Aug = 0
  return Math.floor(idx / 3) + 1;
}

export function fiscalQuarterLabel(month: string): string {
  return `Q${fiscalQuarter(month)} ${fiscalYearLabel(month)}`;
}

/** The 3 months of the fiscal quarter containing `month`. */
export function fiscalQuarterMonths(month: string): string[] {
  const q = fiscalQuarter(month);
  return fiscalYearMonths(month).slice((q - 1) * 3, q * 3);
}

// ─── Year-to-date + forward planning range ───────────────────────

/** Months from the fiscal-year start (Aug) through `month` inclusive. */
export function fiscalYTDMonths(month: string): string[] {
  return fiscalYearMonths(month).filter((m) => m <= month);
}

/** Forward window: `start` … `start + monthsAhead`, inclusive (24 = 2 years). */
export function budgetMonthRange(start: string, monthsAhead: number): string[] {
  return Array.from({ length: monthsAhead + 1 }, (_, i) => addMonths(start, i));
}

// ─── Roll-ups ────────────────────────────────────────────────────

export type RollupKind = "sum" | "average" | "endOfPeriod";

/**
 * Aggregate chronological values per the metric's rollup kind. Nulls are
 * skipped; returns null when no values are present.
 */
export function rollupValues(
  values: (number | null)[],
  kind: RollupKind
): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  if (kind === "sum") return present.reduce((s, v) => s + v, 0);
  if (kind === "average") {
    return Math.round((present.reduce((s, v) => s + v, 0) / present.length) * 100) / 100;
  }
  // endOfPeriod: last present value in chronological order
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i] as number;
  }
  return null;
}

/** Attainment % = actual / budget × 100 (1dp). Null when budget 0/missing. */
export function attainmentPct(
  actual: number | null,
  budget: number | null
): number | null {
  if (budget == null || budget === 0 || actual == null) return null;
  return Math.round((actual / budget) * 1000) / 10;
}

// ─── Prefill ─────────────────────────────────────────────────────

/** Carry a month's non-null budget values forward to the next month. */
export function prefillBudget(
  prev: Record<string, number | null>
): Record<string, number | null> {
  const next: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (v != null) next[k] = v;
  }
  return next;
}

// ─── Metric registry ─────────────────────────────────────────────

export type BudgetSection = "Finance" | "Acquisition" | "Headcount" | "Sales Targets";
export type BudgetUnit = "kr" | "%" | "#";
export type ActualSource = "settings" | "synced" | "none";

export interface BudgetMetric {
  /** Stable key — used as budget_entries.metric_key and the settings/target column. */
  key: string;
  label: string;
  unit: BudgetUnit;
  /** kr metrics stored in øre (display ÷100); false = value stored as-is. */
  ore: boolean;
  section: BudgetSection;
  rollup: RollupKind;
  /** Where the ACTUAL value comes from. */
  actual: ActualSource;
  /**
   * Which way is "good" for variance/heatmap colouring. higher = beating plan
   * when actual > budget (MRR, margin, activity); lower = beating plan when
   * actual < budget (burn, COGS, CAC); neutral = no good/bad direction.
   */
  goodDirection: GoodDirection;
  /** Exception/heat band half-width in % (default DEFAULT_TOLERANCE_PCT). */
  tolerancePct?: number;
}

export type GoodDirection = "higher" | "lower" | "neutral";

export const BUDGET_METRICS: BudgetMetric[] = [
  // Finance
  { key: "gross_margin_pct", label: "Gross margin", unit: "%", ore: false, section: "Finance", rollup: "average", actual: "settings", goodDirection: "higher" },
  { key: "monthly_cogs", label: "Monthly COGS", unit: "kr", ore: true, section: "Finance", rollup: "sum", actual: "settings", goodDirection: "lower" },
  { key: "monthly_burn", label: "Monthly net burn", unit: "kr", ore: true, section: "Finance", rollup: "sum", actual: "settings", goodDirection: "lower" },
  // Acquisition (S&M)
  { key: "total_cac", label: "Total S&M spend", unit: "kr", ore: true, section: "Acquisition", rollup: "sum", actual: "settings", goodDirection: "lower" },
  { key: "cac_outbound", label: "· Outbound", unit: "kr", ore: true, section: "Acquisition", rollup: "sum", actual: "settings", goodDirection: "lower" },
  { key: "cac_partner", label: "· Partner", unit: "kr", ore: true, section: "Acquisition", rollup: "sum", actual: "settings", goodDirection: "lower" },
  { key: "cac_inbound", label: "· Inbound", unit: "kr", ore: true, section: "Acquisition", rollup: "sum", actual: "settings", goodDirection: "lower" },
  // Headcount
  { key: "employee_count", label: "Employees", unit: "#", ore: false, section: "Headcount", rollup: "endOfPeriod", actual: "settings", goodDirection: "neutral" },
  // Sales Targets (actuals synced from snapshots)
  { key: "target_new_mrr", label: "New MRR", unit: "kr", ore: true, section: "Sales Targets", rollup: "sum", actual: "synced", goodDirection: "higher" },
  { key: "target_new_logos", label: "New logos", unit: "#", ore: false, section: "Sales Targets", rollup: "sum", actual: "synced", goodDirection: "higher" },
  { key: "target_pipeline", label: "Pipeline", unit: "kr", ore: true, section: "Sales Targets", rollup: "sum", actual: "synced", goodDirection: "higher" },
  { key: "target_meetings", label: "Meetings", unit: "#", ore: false, section: "Sales Targets", rollup: "sum", actual: "synced", goodDirection: "higher" },
  { key: "target_calls", label: "Calls", unit: "#", ore: false, section: "Sales Targets", rollup: "sum", actual: "synced", goodDirection: "higher" },
];


// ─── Variance, heatmap & exceptions ───────────────────────────

/** Default exception/heat band half-width (±%) when a metric sets none. */
export const DEFAULT_TOLERANCE_PCT = 10;

export type VarianceBucket = "good" | "warn" | "bad" | "neutral";

/**
 * Signed deviation of actual from budget, as a percentage of the budget
 * magnitude: (actual − budget) / |budget| × 100, 1 dp. Positive = actual above
 * budget (regardless of whether that's good). Null when budget is 0/missing or
 * actual is missing — there is no meaningful variance to colour.
 */
export function signedVariancePct(
  actual: number | null,
  budget: number | null
): number | null {
  if (budget == null || budget === 0 || actual == null) return null;
  return Math.round(((actual - budget) / Math.abs(budget)) * 1000) / 10;
}

/**
 * Classify a signed variance into a direction-aware bucket. `good`/`bad` are
 * beyond ±tolerance in the metric's good/bad direction; `warn` is a mild miss
 * within tolerance; `neutral` is on-or-ahead within tolerance, a neutral-
 * direction metric, or no variance.
 */
export function varianceBucket(
  goodDirection: GoodDirection,
  signed: number | null,
  tolerancePct: number = DEFAULT_TOLERANCE_PCT
): VarianceBucket {
  if (signed == null || goodDirection === "neutral") return "neutral";
  const good = goodDirection === "higher" ? signed : -signed; // good-signed deviation
  if (good >= tolerancePct) return "good";
  if (good <= -tolerancePct) return "bad";
  if (good < 0) return "warn";
  return "neutral";
}

/**
 * Heat intensity for an actual cell: its bucket plus a background opacity that
 * grows with the magnitude of the deviation (0 when neutral, capped at 0.45 for
 * large misses/beats). The UI maps bucket → hue (good=emerald, warn/bad=red).
 */
export function heatScale(
  goodDirection: GoodDirection,
  signed: number | null,
  tolerancePct: number = DEFAULT_TOLERANCE_PCT
): { bucket: VarianceBucket; opacity: number } {
  const bucket = varianceBucket(goodDirection, signed, tolerancePct);
  if (bucket === "neutral" || signed == null) return { bucket, opacity: 0 };
  const mag = Math.abs(signed);
  const opacity = Math.min(0.45, 0.12 + (mag / (tolerancePct * 4)) * 0.33);
  return { bucket, opacity: Math.round(opacity * 100) / 100 };
}

/** A budget/actual pair for one metric in one month, fed to monthExceptions. */
export interface MetricCell {
  metric: BudgetMetric;
  budget: number | null;
  actual: number | null;
}

/** An off-plan metric for a month, surfaced in the exceptions strip. */
export interface BudgetException {
  metricKey: string;
  label: string;
  budget: number;
  actual: number;
  variancePct: number; // signed
  severity: "warn" | "bad";
}

/**
 * The metrics that are off-plan for a month (bucket `warn` or `bad`), worst
 * first: `bad` before `warn`, then by descending |variance|. Metrics with no
 * budget+actual pair, on-plan, or ahead of plan are omitted.
 */
export function monthExceptions(
  rows: MetricCell[],
  tolerancePct: number = DEFAULT_TOLERANCE_PCT
): BudgetException[] {
  const out: BudgetException[] = [];
  for (const { metric, budget, actual } of rows) {
    const signed = signedVariancePct(actual, budget);
    const bucket = varianceBucket(
      metric.goodDirection,
      signed,
      metric.tolerancePct ?? tolerancePct
    );
    if ((bucket === "warn" || bucket === "bad") && signed != null) {
      out.push({
        metricKey: metric.key,
        label: metric.label,
        budget: budget as number,
        actual: actual as number,
        variancePct: signed,
        severity: bucket,
      });
    }
  }
  const rank = { bad: 0, warn: 1 } as const;
  return out.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      Math.abs(b.variancePct) - Math.abs(a.variancePct)
  );
}


// ─── Fill & paste (bulk budget editing) ───────────────────────

/** Parse a pasted display number (spaces stripped, comma→dot). null on blank/NaN. */
function parsePastedNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/** Editable months strictly to the right of `startMonth` (fill-right / ⌘R). */
export function fillRightTargets(startMonth: string, editableMonths: string[]): string[] {
  return editableMonths.filter((m) => m > startMonth);
}

/**
 * Metric keys below `metricKey` within the SAME section, in registry order
 * (fill-down / ⌘D). E.g. cac_outbound → [cac_partner, cac_inbound].
 */
export function fillDownTargets(metricKey: string, metrics: BudgetMetric[]): string[] {
  const idx = metrics.findIndex((m) => m.key === metricKey);
  if (idx < 0) return [];
  const section = metrics[idx].section;
  const out: string[] = [];
  for (let i = idx + 1; i < metrics.length; i++) {
    if (metrics[i].section !== section) break;
    out.push(metrics[i].key);
  }
  return out;
}

/** Split clipboard text into a grid of cells (rows on \n, columns on \t). */
export function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop(); // trailing newline
  return lines.map((line) => line.split("\t"));
}

/**
 * Reduce a clipboard grid to a single line of numbers + its orientation: a lone
 * row pastes across months (right); anything taller pastes down its first column.
 */
export function flattenClipboard(cells: string[][]): {
  values: (number | null)[];
  orientation: "down" | "right";
} {
  if (cells.length === 1) {
    return { values: cells[0].map(parsePastedNumber), orientation: "right" };
  }
  return { values: cells.map((r) => parsePastedNumber(r[0] ?? "")), orientation: "down" };
}

export type PasteField = "budget" | "actual";

/** A cell the paste could land on, with whether it accepts an edit. */
export interface PasteCandidate {
  month: string;
  metricKey: string;
  field: PasteField;
  editable: boolean;
}

/** A resolved write: the display value to set on an editable cell. */
export interface PasteTarget {
  month: string;
  metricKey: string;
  field: PasteField;
  value: number | null; // DISPLAY units — caller converts to native via metric.ore
}

/**
 * Zip pasted values onto candidate cells in order, assigning to consecutive
 * EDITABLE cells only (synced/future cells are skipped without consuming a
 * value, so the column lands where the user can actually type).
 */
export function planPaste(
  values: (number | null)[],
  candidates: PasteCandidate[]
): PasteTarget[] {
  const out: PasteTarget[] = [];
  let vi = 0;
  for (const c of candidates) {
    if (vi >= values.length) break;
    if (!c.editable) continue;
    out.push({ month: c.month, metricKey: c.metricKey, field: c.field, value: values[vi] });
    vi++;
  }
  return out;
}


// ─── Cash runway ──────────────────────────────────────────────

/** A month and the projected cash balance entering it (DKK øre). */
export interface CashPoint {
  month: string;
  cash: number;
}

/**
 * Project the cash balance forward from `startingCashOre` at `startMonth`,
 * subtracting each month's burn. `burnByMonth` is keyed YYYY-MM (øre, positive =
 * cash out); months absent from it burn 0. The first point is `startMonth` at
 * the full starting balance, then `cash[m] = startCash − Σ burn[startMonth..m-1]`.
 */
export function projectCashRunway(
  startingCashOre: number,
  startMonth: string,
  burnByMonth: Record<string, number>,
  horizon = 24
): CashPoint[] {
  const out: CashPoint[] = [{ month: startMonth, cash: startingCashOre }];
  let cash = startingCashOre;
  let m = startMonth;
  for (let i = 0; i < horizon; i++) {
    cash -= burnByMonth[m] ?? 0;
    m = addMonths(m, 1);
    out.push({ month: m, cash });
  }
  return out;
}

/**
 * Months of runway = cash ÷ average monthly burn (1 dp). null when not burning
 * (avg ≤ 0) — runway is effectively infinite.
 */
export function monthsOfRunway(
  startingCashOre: number,
  avgMonthlyBurnOre: number
): number | null {
  if (avgMonthlyBurnOre <= 0) return null;
  return Math.round((startingCashOre / avgMonthlyBurnOre) * 10) / 10;
}

/** First month in a cash series where the balance is ≤ 0, else null. */
export function cashZeroMonth(series: CashPoint[]): string | null {
  for (const p of series) {
    if (p.cash <= 0) return p.month;
  }
  return null;
}


// ─── Budget suggestions (from trailing actuals) ───────────────

/** Reads an actual or budget for a metric/month — supplied by the grid. */
export interface SuggestLookup {
  actual: (metricKey: string, month: string) => number | null;
  budget: (metricKey: string, month: string) => number | null;
}

/**
 * Suggest a budget for `metric` in `month` from the trailing `trailing` months.
 * Sales metrics use synced actuals; finance metrics fall back to the prior
 * BUDGET when an actual is absent (the no-ERP reality — manual finance actuals
 * are sparse). Run-rate metrics (sum/average) return the trailing mean;
 * endOfPeriod (headcount) returns the most recent known value. null when there
 * is nothing to go on. Returned in native units (øre for kr metrics).
 */
export function suggestBudget(
  metric: BudgetMetric,
  month: string,
  lookup: SuggestLookup,
  trailing = 3
): number | null {
  const valueAt = (m: string): number | null => {
    const a = lookup.actual(metric.key, m);
    if (a != null) return a;
    // Finance actuals are sparse without an ERP → lean on the prior budget.
    if (metric.actual === "settings") return lookup.budget(metric.key, m);
    return null;
  };
  const present: number[] = [];
  for (let i = 1; i <= trailing; i++) {
    const v = valueAt(addMonths(month, -i)); // most-recent first
    if (v != null) present.push(v);
  }
  if (present.length === 0) return null;
  const raw =
    metric.rollup === "endOfPeriod"
      ? present[0] // most recent known
      : present.reduce((a, b) => a + b, 0) / present.length; // trailing run-rate
  return metric.ore ? Math.round(raw) : Math.round(raw * 10) / 10;
}


// ─── New-MRR reconcile (budget vs forecast) ───────────────────

export interface NewMrrReconcile {
  budgetTotal: number;
  forecastTotal: number;
  divergencePct: number | null; // signed: + = budget above forecast
  band: "aligned" | "ambitious" | "conservative" | "unknown";
  message: string;
}

/**
 * Compare the New-MRR BUDGET against a forecast's new-MRR over the forecast's
 * horizon (the forecast month set is the reference window). `band` is aligned
 * within ±tolerancePct, ambitious when the plan runs above forecast,
 * conservative below.
 */
export function reconcileNewMrr(
  budgetByMonth: Record<string, number>,
  forecastByMonth: Record<string, number>,
  tolerancePct = 15
): NewMrrReconcile {
  const months = Object.keys(forecastByMonth);
  let budgetTotal = 0;
  let forecastTotal = 0;
  for (const m of months) {
    budgetTotal += budgetByMonth[m] ?? 0;
    forecastTotal += forecastByMonth[m] ?? 0;
  }
  if (forecastTotal === 0) {
    return {
      budgetTotal,
      forecastTotal,
      divergencePct: null,
      band: "unknown",
      message: "No forecast to compare against yet.",
    };
  }
  const divergencePct = Math.round(((budgetTotal - forecastTotal) / forecastTotal) * 1000) / 10;
  const band: NewMrrReconcile["band"] =
    divergencePct > tolerancePct
      ? "ambitious"
      : divergencePct < -tolerancePct
        ? "conservative"
        : "aligned";
  const message =
    band === "aligned"
      ? "New-MRR plan tracks the predicted forecast."
      : band === "ambitious"
        ? `New-MRR plan is ${Math.abs(divergencePct)}% above the predicted forecast.`
        : `New-MRR plan is ${Math.abs(divergencePct)}% below the predicted forecast.`;
  return { budgetTotal, forecastTotal, divergencePct, band, message };
}


// ─── Month close / lock ───────────────────────────────────────

export type MonthStatus = "open" | "closed";

/**
 * Whether a cell is editable given its month's close status. Open (or unknown)
 * months are fully editable. A CLOSED month locks its actuals (self-attested at
 * close) but still allows budget edits — those become a re-forecast layer.
 */
export function isMonthEditable(
  status: MonthStatus | undefined,
  field: "budget" | "actual"
): boolean {
  if (status !== "closed") return true;
  return field === "budget";
}

/**
 * Full-year re-forecast for a metric: actuals-of-record for closed months +
 * current budget for the rest, rolled up the metric's way. This is the live
 * "where will the year land" number beside the static FY budget total.
 */
export function fullYearReforecast(
  fyMonths: string[],
  isClosed: (m: string) => boolean,
  actualOfRecord: (m: string) => number | null,
  budget: (m: string) => number | null,
  rollup: RollupKind
): number | null {
  const vals = fyMonths.map((m) => (isClosed(m) ? actualOfRecord(m) : budget(m)));
  return rollupValues(vals, rollup);
}

/**
 * Drift of the current (re-forecast) budget from the plan of record snapshotted
 * at close, as a signed %. Positive = revised up since close.
 */
export function planVsReforecastDrift(
  planOfRecord: number | null,
  current: number | null
): number | null {
  return signedVariancePct(current, planOfRecord);
}
