import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
  type Subscription,
} from "@/lib/frisbii";
import {
  calculateMRR,
  calculateARR,
  calculateARPC,
  decomposeMRR,
  calculateNRR,
  calculateGRR,
  calculateQuickRatio,
  calculateConcentration,
  calculateLogoRetention,
  calculateMRRGrowth,
  type CustomerMRRSnapshot,
} from "@/lib/metrics";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Format a Date to YYYY-MM.
 */
function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Parse a YYYY-MM string into year and 0-indexed month number.
 */
function parseMonth(month: string): { year: number; monthIdx: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, monthIdx: m - 1 };
}

/**
 * Get the YYYY-MM string for the previous month.
 */
function previousMonth(month: string): string {
  const { year, monthIdx } = parseMonth(month);
  return toMonthKey(new Date(year, monthIdx - 1, 1));
}

/**
 * Get the YYYY-MM string for the same month one year ago.
 */
function previousYear(month: string): string {
  const { year, monthIdx } = parseMonth(month);
  return toMonthKey(new Date(year - 1, monthIdx, 1));
}

/**
 * Check whether a subscription was active (or created) within a given month.
 */
function isCreatedInMonth(sub: Subscription, month: string): boolean {
  const created = sub.activated || sub.created;
  return created.startsWith(month);
}

/**
 * Check whether a subscription expired/cancelled within a given month.
 */
function isChurnedInMonth(sub: Subscription, month: string): boolean {
  if (sub.expired && sub.expired.startsWith(month)) return true;
  if (sub.cancelled && sub.cancelled.startsWith(month)) return true;
  return false;
}

// ─── Main sync ─────────────────────────────────────────────────

/**
 * Calculate and upsert the monthly aggregate snapshot for a given month.
 *
 * This is the core revenue metrics aggregation. It must run AFTER
 * `syncCustomerSnapshots` so that the `customer_snapshots` table has
 * current-month data for MRR decomposition.
 *
 * Commentary fields (executive_summary, highlights, lowlights, whats_ahead)
 * are preserved from any existing row -- they are only written by humans.
 *
 * @param month - YYYY-MM format
 */
export async function syncMonthlySnapshot(month: string): Promise<void> {
  console.log(`[sync-frisbii] Starting monthly snapshot for ${month}`);

  const supabase = createAdminClient();

  // ── 1. Fetch Frisbii data ──────────────────────────────────
  const [allSubscriptions, plans] = await Promise.all([
    listSubscriptions(),
    listPlans(),
  ]);

  const planMap = buildPlanMap(plans);

  const activeSubscriptions = allSubscriptions.filter(
    (s) => s.state === "active"
  );
  const addOnTotals = await fetchSubscriptionAddOnTotals(activeSubscriptions);

  // Subscriptions new this month
  const newThisMonth = allSubscriptions.filter((s) =>
    isCreatedInMonth(s, month)
  );

  // Subscriptions churned this month (expired or cancelled)
  const churnedThisMonth = allSubscriptions.filter((s) =>
    isChurnedInMonth(s, month)
  );

  console.log(
    `[sync-frisbii] Active: ${activeSubscriptions.length}, New: ${newThisMonth.length}, Churned: ${churnedThisMonth.length}`
  );

  // ── 2. Core MRR metrics ────────────────────────────────────
  const mrr = Math.round(calculateMRR(activeSubscriptions, planMap, addOnTotals));
  const arr = calculateARR(mrr);
  const customerCount = activeSubscriptions.length;
  const arpa = Math.round(calculateARPC(mrr, customerCount));

  // ── 3. MRR decomposition from customer snapshots ───────────
  const prevMonthKey = previousMonth(month);

  const [{ data: currentSnaps }, { data: prevSnaps }] = await Promise.all([
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, status, plan_handle")
      .eq("month", month),
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, status, plan_handle")
      .eq("month", prevMonthKey),
  ]);

  const toMRRSnap = (
    rows: { customer_id: number; mrr: number; status: string; plan_handle: string | null }[] | null
  ): CustomerMRRSnapshot[] =>
    (rows || []).map((r) => ({
      customerId: String(r.customer_id),
      mrr: r.mrr,
      status: r.status,
      planHandle: r.plan_handle || "",
    }));

  const currentSnapshots = toMRRSnap(currentSnaps);
  const prevSnapshots = toMRRSnap(prevSnaps);

  const decomposition = decomposeMRR(currentSnapshots, prevSnapshots);

  console.log(
    `[sync-frisbii] Decomposition: new=${decomposition.newMRR}, expansion=${decomposition.expansionMRR}, ` +
      `contraction=${decomposition.contractionMRR}, churned=${decomposition.churnedMRR}`
  );

  // ── 4. Retention metrics ───────────────────────────────────
  const prevMRR = prevSnapshots.reduce((sum, s) => sum + s.mrr, 0);

  // End MRR from customers that existed at start of month (exclude new)
  const prevCustomerIds = new Set(prevSnapshots.map((s) => s.customerId));
  const endMRRExisting = currentSnapshots
    .filter((s) => prevCustomerIds.has(s.customerId))
    .reduce((sum, s) => sum + s.mrr, 0);

  const nrr = calculateNRR(prevMRR, endMRRExisting);
  const grr = calculateGRR(
    prevMRR,
    decomposition.contractionMRR,
    decomposition.churnedMRR
  );

  // Quick Ratio
  const quickRatio = calculateQuickRatio(
    decomposition.newMRR,
    decomposition.expansionMRR,
    decomposition.churnedMRR,
    decomposition.contractionMRR
  );
  // Cap infinity for DB storage
  const quickRatioValue = Number.isFinite(quickRatio) ? quickRatio : null;

  // ── 5. Concentration ───────────────────────────────────────
  const customerMRRs = currentSnapshots
    .filter((s) => s.mrr > 0)
    .map((s) => s.mrr);
  const top10Concentration = calculateConcentration(customerMRRs, 10);

  // ── 6. Logo retention ──────────────────────────────────────
  const prevCustomerCount = prevSnapshots.length;
  const churnedLogos = churnedThisMonth.length;
  const newLogos = newThisMonth.length;
  const logoRetention = calculateLogoRetention(prevCustomerCount, churnedLogos);

  // ── 7. Growth rates ────────────────────────────────────────
  // Month-over-month
  const { data: prevRow } = await supabase
    .from("monthly_snapshots")
    .select("mrr")
    .eq("month", prevMonthKey)
    .maybeSingle();

  const mrrGrowthMoM = prevRow
    ? calculateMRRGrowth(mrr, prevRow.mrr)
    : null;

  // Year-over-year
  const prevYearKey = previousYear(month);
  const { data: prevYearRow } = await supabase
    .from("monthly_snapshots")
    .select("mrr")
    .eq("month", prevYearKey)
    .maybeSingle();

  const mrrGrowthYoY = prevYearRow
    ? calculateMRRGrowth(mrr, prevYearRow.mrr)
    : null;

  // ── 8. Preserve commentary fields ──────────────────────────
  const { data: existingRow } = await supabase
    .from("monthly_snapshots")
    .select("executive_summary, highlights, lowlights, whats_ahead")
    .eq("month", month)
    .maybeSingle();

  // ── 9. Upsert ──────────────────────────────────────────────
  const row = {
    month,
    mrr,
    arr,
    net_new_mrr: decomposition.netNewMRR,
    new_mrr: decomposition.newMRR,
    expansion_mrr: decomposition.expansionMRR,
    contraction_mrr: decomposition.contractionMRR,
    churned_mrr: decomposition.churnedMRR,
    non_recurring_revenue: 0, // placeholder -- no non-recurring source yet
    nrr,
    grr,
    logo_retention_rate: logoRetention,
    quick_ratio: quickRatioValue,
    customer_count: customerCount,
    new_logos: newLogos,
    churned_logos: churnedLogos,
    arpa,
    top10_concentration: top10Concentration,
    mrr_growth_mom: mrrGrowthMoM,
    mrr_growth_yoy: mrrGrowthYoY,
    // Preserve existing commentary
    executive_summary: existingRow?.executive_summary ?? null,
    highlights: existingRow?.highlights ?? null,
    lowlights: existingRow?.lowlights ?? null,
    whats_ahead: existingRow?.whats_ahead ?? null,
  };

  const { error } = await supabase
    .from("monthly_snapshots")
    .upsert(row, { onConflict: "month" });

  if (error) {
    console.error(`[sync-frisbii] Upsert failed:`, error);
    throw new Error(`[sync-frisbii] Upsert failed: ${error.message}`);
  }

  console.log(
    `[sync-frisbii] Successfully synced monthly snapshot for ${month}: ` +
      `MRR=${mrr}, ARR=${arr}, customers=${customerCount}, NRR=${nrr}%, GRR=${grr}%`
  );
}
