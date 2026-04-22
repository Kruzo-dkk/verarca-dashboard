import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
  type Subscription,
  type Plan,
} from "@/lib/frisbii";
import { calculateMRR } from "@/lib/metrics";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLog } from "./logger";

/**
 * Compute MRR for a single subscription, normalised to monthly.
 * Mirrors the logic in metrics.ts subscriptionMRR but accessible here.
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

/**
 * Check whether a subscription was active during a given month.
 *
 * A subscription was active during month M if:
 *   1. It was activated/created on or before the last day of M, AND
 *   2. EITHER it is currently active (state === "active"),
 *      OR it has an end date on or after the first day of M
 *      (i.e., it was properly terminated during or after this month)
 *
 * Subscriptions that are expired/on_hold WITHOUT end dates are excluded —
 * these are typically manually deactivated in Frisbii without a billing
 * lifecycle event and should not count as active.
 */
function wasActiveDuringMonth(sub: Subscription, month: string): boolean {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  // When was the subscription activated?
  const activatedDate = (sub.activated || sub.created)?.slice(0, 10);
  if (!activatedDate || activatedDate > monthEnd) return false;

  // Currently active subscriptions are always included
  if (sub.state === "active") return true;

  // For non-active subscriptions, require an end date to prove they were
  // active during this month (not a ghost with no termination record)
  const endDate = (sub.expired_date || sub.cancelled_date)?.slice(0, 10) ?? null;
  if (!endDate) return false; // no end date + not active = ghost subscription
  if (endDate < monthStart) return false; // ended before this month

  return true;
}

/**
 * Sync per-customer monthly MRR snapshots into `customer_snapshots`.
 *
 * For each customer in the `customers` table, determines which subscription
 * was active during the target month and computes their MRR accordingly.
 * This works for both current and historical months.
 *
 * @param month - YYYY-MM format
 */
export async function syncCustomerSnapshots(month: string): Promise<void> {
  syncLog.info(`[sync-customer-snapshots] Starting snapshot sync for ${month}`);

  const supabase = createAdminClient();

  // ── Fetch all customers from the DB ────────────────────────
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id, frisbii_handle, plan_handle, status");

  if (custError) {
    throw new Error(
      `[sync-customer-snapshots] Failed to fetch customers: ${custError.message}`
    );
  }

  if (!customers || customers.length === 0) {
    syncLog.info("[sync-customer-snapshots] No customers found, skipping");
    return;
  }

  syncLog.info(
    `[sync-customer-snapshots] Found ${customers.length} customers in DB`
  );

  // ── Fetch Frisbii data ─────────────────────────────────────
  const [allSubscriptions, plans] = await Promise.all([
    listSubscriptions(),
    listPlans(),
  ]);

  const planMap = buildPlanMap(plans);

  // Fetch add-on totals for subscriptions that were active during this month
  const subsActiveDuringMonth = allSubscriptions.filter((s) =>
    wasActiveDuringMonth(s, month)
  );
  const addOnTotals = await fetchSubscriptionAddOnTotals(subsActiveDuringMonth);

  syncLog.info(
    `[sync-customer-snapshots] Fetched ${allSubscriptions.length} subscriptions, ${plans.length} plans, ` +
      `${subsActiveDuringMonth.length} active during ${month}`
  );

  // ── Map customer handle -> subscription active during this month ──
  const subByCustomer = new Map<string, Subscription>();
  for (const sub of subsActiveDuringMonth) {
    if (!subByCustomer.has(sub.customer)) {
      subByCustomer.set(sub.customer, sub);
    }
  }

  // ── Build snapshot rows ────────────────────────────────────
  const rows: {
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

    rows.push({
      customer_id: customer.id,
      month,
      mrr,
      status,
      plan_handle: planHandle,
      plan_name: planName,
    });
  }

  syncLog.info(
    `[sync-customer-snapshots] Built ${rows.length} snapshots ` +
      `(active: ${rows.filter((r) => r.status === "active").length}, ` +
      `total MRR: ${rows.reduce((s, r) => s + r.mrr, 0)})`
  );

  // ── Upsert in batches ──────────────────────────────────────
  // The unique constraint is on (customer_id, month)
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("customer_snapshots")
      .upsert(batch, { onConflict: "customer_id,month" });

    if (error) {
      syncLog.error(
        `[sync-customer-snapshots] Upsert batch ${i / BATCH_SIZE + 1} failed:`,
        error
      );
      throw new Error(
        `[sync-customer-snapshots] Upsert failed: ${error.message}`
      );
    }
  }

  syncLog.info(
    `[sync-customer-snapshots] Successfully synced ${rows.length} snapshots for ${month}`
  );
}
