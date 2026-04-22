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
  countActiveCustomers,
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
import {
  getExcludedSubscriptionHandles,
  getReplacementMap,
} from "./get-exclusions";
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

  // Derive all aggregate metrics from customer snapshots (single source of truth)
  // This ensures monthly_snapshots always matches SUM(customer_snapshots)
  const mrr = currentSnapshots
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.mrr, 0);
  const arr = calculateARR(mrr);
  const customerCount = countActiveCustomers(currentSnapshots);
  const arpa = Math.round(calculateARPC(mrr, customerCount));

  if (frisbiiMRR !== mrr) {
    syncLog.info(
      `[sync-frisbii] MRR: snapshot=${mrr}, frisbii=${frisbiiMRR}, delta=${Math.abs(mrr - frisbiiMRR)}`
    );
  }

  // Build customer links for replacement subscriptions (old ID → new ID)
  // so that decomposeMRR treats them as continuity, not churn+new
  const replacementMap = await getReplacementMap();
  let customerLinks: Map<string, string> | undefined;

  if (replacementMap.size > 0) {
    // Look up customer DB IDs for the replacement customer handles
    const customerHandles = [...replacementMap.keys()];
    const { data: linkedCustomers } = await supabase
      .from("customers")
      .select("id, frisbii_handle")
      .in("frisbii_handle", customerHandles);

    if (linkedCustomers && linkedCustomers.length > 0) {
      const handleToId = new Map(
        linkedCustomers.map((c) => [c.frisbii_handle, String(c.id)])
      );
      customerLinks = new Map<string, string>();

      for (const [customerHandle] of replacementMap) {
        const oldId = handleToId.get(customerHandle);
        // The replacement sub belongs to the same customer handle in most cases,
        // so oldId === newId. Only add link when they differ.
        if (oldId) {
          // For now, links are identity — future: support different customer handles
          customerLinks.set(oldId, oldId);
        }
      }

      // Remove identity mappings (no-ops)
      for (const [k, v] of customerLinks) {
        if (k === v) customerLinks.delete(k);
      }
      if (customerLinks.size === 0) customerLinks = undefined;
    }
  }

  const decomposition = decomposeMRR(currentSnapshots, prevSnapshots, customerLinks);

  syncLog.info(
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
    syncLog.error(`[sync-frisbii] Upsert failed:`, error);
    throw new Error(`[sync-frisbii] Upsert failed: ${error.message}`);
  }

  syncLog.info(
    `[sync-frisbii] Successfully synced monthly snapshot for ${month}: ` +
      `MRR=${mrr}, ARR=${arr}, customers=${customerCount}, NRR=${nrr}%, GRR=${grr}%`
  );
}
