/**
 * Shared display formatters for the Sales dashboard panels. Extracted from the
 * per-component copies that had drifted (PipelineBoard, Leaderboard,
 * RecentOutcomes, TargetProgress each redefined these). All are null-safe and
 * return an em dash ("—") for missing values so frozen snapshots that predate
 * the deal-timestamp fields render cleanly.
 */

const EM_DASH = "—";

/** Format DKK minor units (øre) as "kr 12.345" (da-DK grouping, no decimals). */
export function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

/** Short da-DK date e.g. "31. aug.". Returns "—" when null/undefined/invalid. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return EM_DASH;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return EM_DASH;
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

/** Deal age label e.g. "12 dage i forløb" / "1 dag i forløb". "—" when null. */
export function formatDealAge(ageDays: number | null | undefined): string {
  if (ageDays == null) return EM_DASH;
  return `${ageDays} ${ageDays === 1 ? "dag" : "dage"} i forløb`;
}

/** Whole-percent from a 0–1 decimal, e.g. 0.42 → "42%". "—" when null. */
export function formatPercent01(value: number | null | undefined): string {
  if (value == null) return EM_DASH;
  return `${Math.round(value * 100)}%`;
}
