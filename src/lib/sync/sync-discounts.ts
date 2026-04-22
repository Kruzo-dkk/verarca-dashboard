import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionDiscountDetails,
  getDiscount,
  type Subscription,
  type Plan,
  type Discount,
  type SubscriptionDiscount,
} from "@/lib/frisbii";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Compute the monthly discount impact for a subscription.
 *
 * For percentage discounts: (plan list price × qty / interval) × percentage/100
 * For fixed discounts: fixed amount / interval
 */
function computeMonthlyImpact(
  sub: Subscription,
  planMap: Map<string, Plan>,
  discount: SubscriptionDiscount,
  baseDiscount: Discount | null
): number {
  const plan = planMap.get(sub.plan);
  const intervalLength = plan?.interval_length ?? 12;
  const planAmount = plan?.amount ?? 0;
  const quantity = sub.quantity || 1;
  const monthlyListPrice = (planAmount * quantity) / intervalLength;

  // Use subscription-level override, fall back to base discount definition
  const percentage = discount.percentage ?? baseDiscount?.percentage ?? null;
  const fixedAmount = discount.amount ?? baseDiscount?.amount ?? null;

  if (percentage != null && percentage > 0) {
    return Math.round(monthlyListPrice * (percentage / 100));
  }

  if (fixedAmount != null && fixedAmount > 0) {
    return Math.round(fixedAmount / intervalLength);
  }

  return 0;
}

/**
 * Check whether a subscription was active during a given month.
 */
function wasActiveDuringMonth(sub: Subscription, month: string): boolean {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const activatedDate = (sub.activated || sub.created)?.slice(0, 10);
  if (!activatedDate || activatedDate > monthEnd) return false;

  const endDate = (sub.expired_date || sub.cancelled_date)?.slice(0, 10) ?? null;
  if (endDate && endDate < monthStart) return false;

  return true;
}

/**
 * Sync discount snapshots for all active subscriptions in a given month.
 *
 * For each subscription with discounts:
 *   1. Fetch subscription-level discount details from Frisbii
 *   2. Fetch base discount definition for each discount
 *   3. Compute the monthly impact
 *   4. Upsert into discount_snapshots
 *
 * @param month - YYYY-MM format
 */
export async function syncDiscounts(month: string): Promise<void> {
  console.log(`[sync-discounts] Starting discount sync for ${month}`);

  const supabase = createAdminClient();

  // ── Fetch customers for ID lookup ─────────────────────────
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id, frisbii_handle");

  if (custError) {
    throw new Error(
      `[sync-discounts] Failed to fetch customers: ${custError.message}`
    );
  }

  const customerByHandle = new Map(
    (customers ?? []).map((c) => [c.frisbii_handle, c.id])
  );

  // ── Fetch Frisbii data ─────────────────────────────────────
  const [allSubscriptions, plans] = await Promise.all([
    listSubscriptions(),
    listPlans(),
  ]);

  const planMap = buildPlanMap(plans);

  // Filter to subscriptions active during this month
  const activeSubscriptions = allSubscriptions.filter((s) =>
    wasActiveDuringMonth(s, month)
  );

  // Filter to only those with discounts
  const subsWithDiscounts = activeSubscriptions.filter(
    (s) =>
      (s.subscription_discounts && s.subscription_discounts.length > 0) ||
      s.discount
  );

  console.log(
    `[sync-discounts] Found ${subsWithDiscounts.length} subscriptions with discounts ` +
      `(out of ${activeSubscriptions.length} active)`
  );

  if (subsWithDiscounts.length === 0) {
    console.log("[sync-discounts] No discounts to sync");
    return;
  }

  // Fetch subscription-level discount details
  const discountDetailsMap =
    await fetchSubscriptionDiscountDetails(subsWithDiscounts);

  // Cache base discount definitions to avoid redundant API calls
  const baseDiscountCache = new Map<string, Discount | null>();

  async function getBaseDiscount(handle: string): Promise<Discount | null> {
    if (baseDiscountCache.has(handle)) return baseDiscountCache.get(handle)!;
    try {
      const d = await getDiscount(handle);
      baseDiscountCache.set(handle, d);
      return d;
    } catch {
      baseDiscountCache.set(handle, null);
      return null;
    }
  }

  // ── Build snapshot rows ────────────────────────────────────
  const rows: {
    month: string;
    subscription_handle: string;
    customer_id: number | null;
    discount_handle: string;
    discount_name: string | null;
    discount_amount: number;
    discount_percentage: number | null;
    discount_type: string;
    monthly_impact: number;
    expires_at: string | null;
  }[] = [];

  for (const sub of subsWithDiscounts) {
    const customerId = customerByHandle.get(sub.customer) ?? null;
    const subDiscounts = discountDetailsMap.get(sub.handle) ?? [];

    for (const sd of subDiscounts) {
      const baseDiscount = await getBaseDiscount(sd.discount || sd.handle);
      const monthlyImpact = computeMonthlyImpact(sub, planMap, sd, baseDiscount);

      const isPercentage =
        (sd.percentage ?? baseDiscount?.percentage ?? null) != null;

      rows.push({
        month,
        subscription_handle: sub.handle,
        customer_id: customerId,
        discount_handle: sd.handle,
        discount_name: sd.name ?? baseDiscount?.name ?? null,
        discount_amount: sd.amount ?? baseDiscount?.amount ?? 0,
        discount_percentage: sd.percentage ?? baseDiscount?.percentage ?? null,
        discount_type: isPercentage ? "percentage" : "fixed",
        monthly_impact: monthlyImpact,
        expires_at: sd.expires ?? null,
      });
    }

    // Handle legacy single-discount field if no subscription_discounts were found
    if (subDiscounts.length === 0 && sub.discount) {
      const baseDiscount = await getBaseDiscount(sub.discount);
      if (baseDiscount) {
        const fakeSubDiscount: SubscriptionDiscount = {
          handle: sub.discount,
          discount: sub.discount,
          state: "active",
          percentage: baseDiscount.percentage,
          amount: baseDiscount.amount,
          created: baseDiscount.created,
        };

        const monthlyImpact = computeMonthlyImpact(
          sub,
          planMap,
          fakeSubDiscount,
          baseDiscount
        );
        const isPercentage = baseDiscount.percentage != null;

        rows.push({
          month,
          subscription_handle: sub.handle,
          customer_id: customerId,
          discount_handle: sub.discount,
          discount_name: baseDiscount.name ?? null,
          discount_amount: baseDiscount.amount ?? 0,
          discount_percentage: baseDiscount.percentage ?? null,
          discount_type: isPercentage ? "percentage" : "fixed",
          monthly_impact: monthlyImpact,
          expires_at: null,
        });
      }
    }
  }

  const totalImpact = rows.reduce((sum, r) => sum + r.monthly_impact, 0);
  console.log(
    `[sync-discounts] Built ${rows.length} discount snapshot rows ` +
      `(total monthly impact: ${totalImpact} øre)`
  );

  // ── Upsert in batches ──────────────────────────────────────
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("discount_snapshots")
      .upsert(batch, {
        onConflict: "month,subscription_handle,discount_handle",
      });

    if (error) {
      console.error(
        `[sync-discounts] Upsert batch ${i / BATCH_SIZE + 1} failed:`,
        error
      );
      throw new Error(
        `[sync-discounts] Upsert failed: ${error.message}`
      );
    }
  }

  console.log(
    `[sync-discounts] Successfully synced ${rows.length} discount snapshots for ${month}`
  );
}
