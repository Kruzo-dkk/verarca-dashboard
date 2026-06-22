import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
  type Subscription,
  type Plan,
} from "@/lib/frisbii";
import { type CustomerMRRSnapshot } from "@/lib/metrics";
import { computeMonthlyMetrics } from "./monthly-metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedLinks } from "./get-customer-links";
import { syncLog } from "./logger";
import { wasActiveDuringMonth } from "./snapshot-helpers";

// ─── Helpers ────────────────────────────────────────────────────

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseMonth(month: string): { year: number; monthIdx: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y, monthIdx: m - 1 };
}

function previousMonth(month: string): string {
  const { year, monthIdx } = parseMonth(month);
  return toMonthKey(new Date(year, monthIdx - 1, 1));
}

function previousYear(month: string): string {
  const { year, monthIdx } = parseMonth(month);
  return toMonthKey(new Date(year - 1, monthIdx, 1));
}

/**
 * Generate an array of YYYY-MM strings from startMonth to endMonth (inclusive).
 */
function monthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  const { year: sy, monthIdx: sm } = parseMonth(startMonth);
  const { year: ey, monthIdx: em } = parseMonth(endMonth);

  let d = new Date(sy, sm, 1);
  const end = new Date(ey, em, 1);

  while (d <= end) {
    months.push(toMonthKey(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  return months;
}

/**
 * Compute MRR for a single subscription normalised to monthly.
 * Mirrors the logic from sync-customer-snapshots.ts.
 */
function singleSubMRR(
  sub: Subscription,
  plans: Map<string, Plan>,
  addOnTotals: Map<string, number>
): number {
  const plan = plans.get(sub.plan);
  const intervalLength = plan?.interval_length ?? 12;
  const planAmount = plan?.amount ?? 0;
  const quantity = sub.quantity || 1;

  let total = (planAmount * quantity) / intervalLength;

  const addOnTotal = addOnTotals.get(sub.handle) ?? 0;
  if (addOnTotal > 0) {
    total += addOnTotal / intervalLength;
  }

  return total;
}

function isCreatedInMonth(sub: Subscription, month: string): boolean {
  const created = sub.activated || sub.created;
  return created.startsWith(month);
}

// ─── Main backfill ──────────────────────────────────────────────

export interface BackfillResult {
  monthsProcessed: number;
  monthsSkipped: number;
  range: { start: string; end: string };
  errors: { month: string; error: string }[];
  durationMs: number;
}

/**
 * Backfill historic monthly_snapshots and customer_snapshots from
 * Frisbii subscription history.
 *
 * For each month from the earliest subscription activation to the month
 * before the current month, this function:
 *   1. Determines which subscriptions were active during that month
 *   2. Computes per-customer MRR and upserts customer_snapshots
 *   3. Computes monthly aggregates (MRR, ARR, decomposition, retention, etc.)
 *   4. Upserts monthly_snapshots
 *
 * Months are processed sequentially because decomposition and growth metrics
 * depend on the previous month's data.
 *
 * @param overrideEndMonth - Optional YYYY-MM to stop at (defaults to previous month)
 */
export async function backfillHistory(
  overrideEndMonth?: string
): Promise<BackfillResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  syncLog.info("[backfill] ========================================");
  syncLog.info("[backfill] Starting historic backfill");
  syncLog.info("[backfill] ========================================");

  // ── 1. Fetch ALL Frisbii data upfront ─────────────────────────
  const [allSubscriptions, plans] = await Promise.all([
    listSubscriptions(), // fetches all, from 2020-01-01
    listPlans(),
  ]);

  const planMap = buildPlanMap(plans);

  // Fetch add-on totals for all subscriptions (not just active)
  const addOnTotals = await fetchSubscriptionAddOnTotals(allSubscriptions);


  syncLog.info(
    `[backfill] Loaded ${allSubscriptions.length} subscriptions, ${plans.length} plans`
  );

  // ── 2. Fetch all customers from DB ────────────────────────────
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id, frisbii_handle, plan_handle, status, churn_date, cvr")
    .eq("excluded", false);

  if (custError) {
    throw new Error(`[backfill] Failed to fetch customers: ${custError.message}`);
  }

  if (!customers || customers.length === 0) {
    throw new Error("[backfill] No customers found. Run syncCustomers() first.");
  }

  syncLog.info(`[backfill] Found ${customers.length} customers in DB`);

  // customer_id → cvr, so collapseLinkedSnapshots can de-dupe identical subs.
  const cvrById = new Map(customers.map((c) => [String(c.id), c.cvr ?? null]));

  // ── Customer linking: dedupe real-world customers with multiple handles.
  //    Built once (current state) and applied to every historic month. ──
  const confirmedLinks = await getConfirmedLinks(); // linkedHandle → canonicalHandle
  // customer_id → canonical id, for event-based churn MRR summation.

  // ── 3. Determine date range ───────────────────────────────────
  const activationDates = allSubscriptions
    .map((s) => (s.activated || s.created)?.slice(0, 7))
    .filter(Boolean) as string[];

  if (activationDates.length === 0) {
    throw new Error("[backfill] No subscription activation dates found");
  }

  const startMonth = activationDates.sort()[0];
  const now = new Date();
  const currentMonthKey = toMonthKey(now);
  const endMonth =
    overrideEndMonth ?? previousMonth(currentMonthKey);

  if (startMonth > endMonth) {
    syncLog.info("[backfill] Start month is after end month, nothing to backfill");
    return {
      monthsProcessed: 0,
      monthsSkipped: 0,
      range: { start: startMonth, end: endMonth },
      errors: [],
      durationMs: Date.now() - startTime,
    };
  }

  const months = monthRange(startMonth, endMonth);
  syncLog.info(
    `[backfill] Will process ${months.length} months: ${startMonth} → ${endMonth}`
  );

  // ── 4. Process each month sequentially ────────────────────────
  const errors: { month: string; error: string }[] = [];
  let processed = 0;
  let skipped = 0;

  for (const month of months) {
    try {
      // --- 4a. Find subscriptions active during this month ---
      const subsActiveDuringMonth = allSubscriptions.filter((s) =>
        wasActiveDuringMonth(s, month)
      );

      // Map customer handle → active subscription
      const subByCustomer = new Map<string, Subscription>();
      for (const sub of subsActiveDuringMonth) {
        if (!subByCustomer.has(sub.customer)) {
          subByCustomer.set(sub.customer, sub);
        }
      }

      // --- 4b. Build and upsert customer_snapshots ---
      const custSnapRows: {
        customer_id: number;
        month: string;
        mrr: number;
        status: string;
        plan_handle: string | null;
        plan_name: string | null;
      }[] = [];

      for (const customer of customers) {
        const sub = subByCustomer.get(customer.frisbii_handle);
        let mrr = 0;
        let status = "churned";
        let planHandle = customer.plan_handle;

        if (sub) {
          mrr = Math.round(singleSubMRR(sub, planMap, addOnTotals));
          status = "active";
          planHandle = sub.plan;
        }

        const planName = planHandle ? (planMap.get(planHandle)?.name ?? planHandle) : null;

        custSnapRows.push({
          customer_id: customer.id,
          month,
          mrr,
          status,
          plan_handle: planHandle,
          plan_name: planName,
        });
      }

      // Upsert customer_snapshots in batches
      const BATCH = 100;
      for (let i = 0; i < custSnapRows.length; i += BATCH) {
        const batch = custSnapRows.slice(i, i + BATCH);
        const { error } = await supabase
          .from("customer_snapshots")
          .upsert(batch, { onConflict: "customer_id,month" });
        if (error) throw error;
      }

      // --- 4c. Compute monthly aggregate metrics ---
      const currentSnapshots: CustomerMRRSnapshot[] = custSnapRows.map((r) => ({
        customerId: String(r.customer_id),
        mrr: r.mrr,
        status: r.status,
        planHandle: r.plan_handle || "",
        cvr: cvrById.get(String(r.customer_id)) ?? null,
      }));

      // Fetch previous month's customer snapshots for decomposition
      const prevMonthKey = previousMonth(month);
      const { data: prevSnaps } = await supabase
        .from("customer_snapshots")
        .select("customer_id, mrr, status, plan_handle")
        .eq("month", prevMonthKey);

      const prevSnapshots: CustomerMRRSnapshot[] = (prevSnaps || []).map((r) => ({
        customerId: String(r.customer_id),
        mrr: r.mrr,
        status: r.status,
        planHandle: r.plan_handle || "",
        cvr: cvrById.get(String(r.customer_id)) ?? null,
      }));

      // Aggregate metrics — single source of truth (monthly-metrics.ts),
      // shared with syncMonthlySnapshot so the two paths cannot drift.
      const newLogos = allSubscriptions.filter((sub) => isCreatedInMonth(sub, month)).length;
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
        newLogos,
        prevMonthMRR: prevRow?.mrr ?? null,
        prevYearMRR: prevYearRow?.mrr ?? null,
      });
      // Check if month is locked
      const { data: lockCheck } = await supabase
        .from("monthly_snapshots")
        .select("locked_at")
        .eq("month", month)
        .maybeSingle();

      if (lockCheck?.locked_at) {
        syncLog.info(`[backfill] ${month} is locked (${lockCheck.locked_at}), skipping`);
        skipped++;
        continue;
      }

      // Preserve existing commentary
      const { data: existingRow } = await supabase
        .from("monthly_snapshots")
        .select("executive_summary, highlights, lowlights, whats_ahead")
        .eq("month", month)
        .maybeSingle();

      // --- 4d. Upsert monthly_snapshots ---
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
        non_recurring_revenue: 0,
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
        executive_summary: existingRow?.executive_summary ?? null,
        highlights: existingRow?.highlights ?? null,
        lowlights: existingRow?.lowlights ?? null,
        whats_ahead: existingRow?.whats_ahead ?? null,
      };

      const { error: upsertError } = await supabase
        .from("monthly_snapshots")
        .upsert(row, { onConflict: "month" });

      if (upsertError) throw upsertError;

      processed++;
      syncLog.info(
        `[backfill] ${month}: MRR=${m.mrr}, ARR=${m.arr}, customers=${m.customerCount}, ` +
          `new=${m.newLogos}, churned=${m.churnedLogos}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      syncLog.error(`[backfill] ${month} FAILED: ${message}`);
      errors.push({ month, error: message });
      skipped++;
    }
  }

  const durationMs = Date.now() - startTime;

  syncLog.info("[backfill] ========================================");
  syncLog.info(
    `[backfill] Complete: ${processed} processed, ${skipped} skipped, ` +
      `${errors.length} errors in ${durationMs}ms`
  );
  syncLog.info("[backfill] ========================================");

  return {
    monthsProcessed: processed,
    monthsSkipped: skipped,
    range: { start: startMonth, end: endMonth },
    errors,
    durationMs,
  };
}
