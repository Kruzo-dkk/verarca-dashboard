import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
  type Subscription,
} from "@/lib/frisbii";
import {
  calculateMRR,
  type CustomerChurnState,
  type CustomerMRRSnapshot,
} from "@/lib/metrics";
import { computeMonthlyMetrics } from "./monthly-metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExcludedSubscriptionHandles } from "./get-exclusions";
import { getConfirmedLinks } from "./get-customer-links";
import { syncLog } from "./logger";

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
 * Excluded subscriptions (administrative replacements etc.) are skipped.
 */
function isChurnedInMonth(
  sub: Subscription,
  month: string,
  excludedHandles?: Set<string>
): boolean {
  if (excludedHandles?.has(sub.handle)) return false;
  if (sub.expired_date && sub.expired_date.startsWith(month)) return true;
  if (sub.cancelled_date && sub.cancelled_date.startsWith(month)) return true;
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
  syncLog.info(`[sync-frisbii] Starting monthly snapshot for ${month}`);

  const supabase = createAdminClient();

  // ── Check if month is locked ──────────────────────────────
  const { data: lockCheck } = await supabase
    .from("monthly_snapshots")
    .select("locked_at")
    .eq("month", month)
    .maybeSingle();

  if (lockCheck?.locked_at) {
    syncLog.info(
      `[sync-frisbii] Month ${month} is locked (${lockCheck.locked_at}), skipping`
    );
    return;
  }

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

  // Fetch subscription exclusions (administrative replacements etc.)
  const excludedHandles = await getExcludedSubscriptionHandles();

  // Subscriptions new this month
  const newThisMonth = allSubscriptions.filter((s) =>
    isCreatedInMonth(s, month)
  );

  // Subscriptions churned this month (expired or cancelled), excluding administrative
  const churnedThisMonth = allSubscriptions.filter((s) =>
    isChurnedInMonth(s, month, excludedHandles)
  );

  syncLog.info(
    `[sync-frisbii] Active: ${activeSubscriptions.length}, New: ${newThisMonth.length}, Churned: ${churnedThisMonth.length}`
  );

  // ── 2. Frisbii API MRR (for cross-system comparison) ───────
  const frisbiiMRR = Math.round(calculateMRR(activeSubscriptions, planMap, addOnTotals));

  // ── 3. MRR decomposition from customer snapshots ───────────
  const prevMonthKey = previousMonth(month);

  const [{ data: currentSnaps }, { data: prevSnaps }, { data: allCustomerRows }] =
    await Promise.all([
      supabase
        .from("customer_snapshots")
        .select("customer_id, mrr, status, plan_handle")
        .eq("month", month),
      supabase
        .from("customer_snapshots")
        .select("customer_id, mrr, status, plan_handle")
        .eq("month", prevMonthKey),
      supabase
        .from("customers")
        .select("id, frisbii_handle, churn_date, status, cvr")
        .eq("excluded", false),
    ]);

  const customers = (allCustomerRows ?? []) as CustomerChurnState[];
  // customer_id → cvr, so collapseLinkedSnapshots can de-dupe identical subs.
  const cvrById = new Map(
    (allCustomerRows ?? []).map((c) => [String(c.id), c.cvr ?? null])
  );

  const toMRRSnap = (
    rows: { customer_id: number; mrr: number; status: string; plan_handle: string | null }[] | null
  ): CustomerMRRSnapshot[] =>
    (rows || []).map((r) => ({
      customerId: String(r.customer_id),
      mrr: r.mrr,
      status: r.status,
      planHandle: r.plan_handle || "",
      cvr: cvrById.get(String(r.customer_id)) ?? null,
    }));

  const currentSnapshots = toMRRSnap(currentSnaps);
  const prevSnapshots = toMRRSnap(prevSnaps);

  // Customer linking + aggregate metrics — single source of truth shared with
  // backfillHistory (monthly-metrics.ts), so the live and historic paths cannot drift.
  const confirmedLinks = await getConfirmedLinks(); // linkedHandle → canonicalHandle

  const { data: prevRow } = await supabase
    .from("monthly_snapshots").select("mrr").eq("month", prevMonthKey).maybeSingle();
  const { data: prevYearRow } = await supabase
    .from("monthly_snapshots").select("mrr").eq("month", previousYear(month)).maybeSingle();

  const m = computeMonthlyMetrics({
    month,
    currentSnapshots,
    prevSnapshots,
    customers,
    confirmedLinks,
    newLogos: newThisMonth.length,
    prevMonthMRR: prevRow?.mrr ?? null,
    prevYearMRR: prevYearRow?.mrr ?? null,
  });

  if (frisbiiMRR !== m.mrr) {
    syncLog.info(
      `[sync-frisbii] MRR: snapshot=${m.mrr}, frisbii=${frisbiiMRR}, delta=${Math.abs(m.mrr - frisbiiMRR)}`
    );
  }

  // ── 8. Preserve commentary fields ──────────────────────────
  const { data: existingRow } = await supabase
    .from("monthly_snapshots")
    .select("executive_summary, highlights, lowlights, whats_ahead")
    .eq("month", month)
    .maybeSingle();

  // ── 9. Upsert ──────────────────────────────────────────────
  const row = {
    month,
    mrr: m.mrr,
    arr: m.arr,
    net_new_mrr: m.netNewMRR,
    new_mrr: m.newMRR,
    expansion_mrr: m.expansionMRR,
    contraction_mrr: m.contractionMRR,
    churned_mrr: m.churnedMRR,
    churned_mrr_event: m.churnedMrrEvent,
    non_recurring_revenue: 0, // placeholder -- no non-recurring source yet
    nrr: m.nrr,
    grr: m.grr,
    logo_retention_rate: m.logoRetention,
    quick_ratio: m.quickRatio,
    customer_count: m.customerCount,
    new_logos: m.newLogos,
    new_paying_logos: m.newPayingLogos,
    churned_logos: m.churnedLogos,
    arpa: m.arpa,
    top10_concentration: m.top10Concentration,
    mrr_growth_mom: m.mrrGrowthMoM,
    mrr_growth_yoy: m.mrrGrowthYoY,
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
    syncLog.error(`[sync-frisbii] Upsert failed:`, error);
    throw new Error(`[sync-frisbii] Upsert failed: ${error.message}`);
  }

  syncLog.info(
    `[sync-frisbii] Successfully synced monthly snapshot for ${month}: ` +
      `MRR=${m.mrr}, ARR=${m.arr}, customers=${m.customerCount}, NRR=${m.nrr}%, GRR=${m.grr}%`
  );
}
