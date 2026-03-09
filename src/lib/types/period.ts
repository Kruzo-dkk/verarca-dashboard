/**
 * Period types for the enhanced period selector.
 *
 * A period resolves to a start/end month range. The report data
 * aggregator uses:
 * - Point-in-time metrics (MRR, ARR, count, NRR): end month values
 * - Flow metrics (net new, decomposition, new/churned logos): sum across range
 */

export type PeriodType = "month" | "trailing" | "quarter" | "year";

export interface PeriodDescriptor {
  type: PeriodType;
  /** Human-readable label, e.g. "Mar 2026", "Trailing 3M", "Q1 2026", "2025" */
  label: string;
  /** Inclusive start month (YYYY-MM) */
  startMonth: string;
  /** Inclusive end month (YYYY-MM) */
  endMonth: string;
}
