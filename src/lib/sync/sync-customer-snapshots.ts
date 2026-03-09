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
 * Sync per-customer monthly MRR snapshots into `customer_snapshots`.
 *
 * For each customer in the `customers` table, looks up their active
 * subscription and writes a snapshot row for the given month.
 *
 * @param month - YYYY-MM format
 */
export async function syncCustomerSnapshots(month: string): Promise<void> {
  console.log(`[sync-customer-snapshots] Starting snapshot sync for ${month}`);

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
    console.log("[sync-customer-snapshots] No customers found, skipping");
    return;
  }

  console.log(
    `[sync-customer-snapshots] Found ${customers.length} customers in DB`
  );

  // ── Fetch Frisbii data ─────────────────────────────────────
  const [allSubscriptions, plans] = await Promise.all([
    listSubscriptions(),
    listPlans(),
  ]);

  const planMap = buildPlanMap(plans);

  // Only fetch add-on totals for active subscriptions that have add-ons
  const activeSubscriptions = allSubscriptions.filter(
    (s) => s.state === "active"
  );
  const addOnTotals = await fetchSubscriptionAddOnTotals(activeSubscriptions);

  console.log(
    `[sync-customer-snapshots] Fetched ${allSubscriptions.length} subscriptions, ${plans.length} plans`
  );

  // ── Map customer handle -> active subscription ─────────────
  const subByCustomer = new Map<string, Subscription>();
  for (const sub of activeSubscriptions) {
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
  }[] = [];

  for (const customer of customers) {
    const sub = subByCustomer.get(customer.frisbii_handle);

    let mrr = 0;
    let status = customer.status || "churned";
    let planHandle = customer.plan_handle;

    if (sub) {
      mrr = Math.round(singleSubMRR(sub, planMap, addOnTotals));
      status = "active";
      planHandle = sub.plan;
    }

    rows.push({
      customer_id: customer.id,
      month,
      mrr,
      status,
      plan_handle: planHandle,
    });
  }

  console.log(
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
      console.error(
        `[sync-customer-snapshots] Upsert batch ${i / BATCH_SIZE + 1} failed:`,
        error
      );
      throw new Error(
        `[sync-customer-snapshots] Upsert failed: ${error.message}`
      );
    }
  }

  console.log(
    `[sync-customer-snapshots] Successfully synced ${rows.length} snapshots for ${month}`
  );
}
