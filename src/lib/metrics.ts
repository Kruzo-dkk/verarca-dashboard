import type { Subscription, Invoice, Plan, AddOn } from "./frisbii";

/**
 * Normalize a plan amount to its monthly equivalent based on billing interval.
 *
 * Industry best practice (Stripe, ChartMogul, Baremetrics):
 * - Divide the cycle amount by the interval length in months
 * - Keep full precision during aggregation to avoid cumulative rounding drift
 * - Round only at display time (handled by formatCurrency in components)
 *
 * @param amount - The plan amount per billing cycle (in minor units, e.g. cents/øre)
 * @param intervalLength - Number of months per billing cycle (1 = monthly, 3 = quarterly, 12 = annual)
 * @returns The monthly equivalent amount in minor units (unrounded for aggregation accuracy)
 */
export function normalizeToMonthly(
  amount: number,
  intervalLength: number
): number {
  // Guard: monthly plans pass through untouched (most common case)
  if (intervalLength === 1) return amount;

  // Guard: invalid or zero interval — treat as monthly to avoid division by zero
  if (!intervalLength || intervalLength <= 0) return amount;

  // Standard normalization: $1200/year (12) = $100/month, $450/quarter (3) = $150/month
  // No rounding here — precision is preserved across the full aggregation.
  // Rounding happens once at display time in formatCurrency().
  return amount / intervalLength;
}

export interface MetricsSummary {
  mrr: number;
  arr: number;
  activeCustomerCount: number;
  churnRate: number;
  netNewMRR: number;
  arpc: number;
  currency: string;
}

/**
 * Calculate the monthly recurring revenue contribution for a single subscription.
 * Includes both the base plan amount and any add-ons.
 */
function subscriptionMRR(
  sub: Subscription,
  plans: Map<string, Plan>,
  addOns: Map<string, AddOn>
): number {
  const plan = plans.get(sub.plan);
  const intervalLength = plan?.interval_length ?? 12;
  const planAmount = sub.amount ?? plan?.amount ?? 0;
  let total = normalizeToMonthly(planAmount * (sub.quantity || 1), intervalLength);

  // Add-ons inherit the plan's billing interval
  for (const addOnHandle of sub.subscription_add_ons ?? []) {
    const addOn = addOns.get(addOnHandle);
    if (addOn) {
      const addOnInterval = addOn.interval_length ?? intervalLength;
      total += normalizeToMonthly(addOn.amount, addOnInterval);
    }
  }

  return total;
}

export function calculateMRR(
  subscriptions: Subscription[],
  plans: Map<string, Plan>,
  addOns: Map<string, AddOn> = new Map()
): number {
  return subscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => sum + subscriptionMRR(sub, plans, addOns), 0);
}

export function calculateARR(mrr: number): number {
  return mrr * 12;
}

export function calculateChurnRate(
  cancelledThisMonth: Subscription[],
  activeAtStartOfMonth: number
): number {
  if (activeAtStartOfMonth === 0) return 0;
  return (cancelledThisMonth.length / activeAtStartOfMonth) * 100;
}

export function calculateNetNewMRR(
  newSubscriptions: Subscription[],
  cancelledSubscriptions: Subscription[],
  plans: Map<string, Plan>,
  addOns: Map<string, AddOn> = new Map()
): number {
  const newMRR = newSubscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => sum + subscriptionMRR(sub, plans, addOns), 0);

  const churnedMRR = cancelledSubscriptions.reduce(
    (sum, sub) => sum + subscriptionMRR(sub, plans, addOns),
    0
  );

  return newMRR - churnedMRR;
}

export function calculateARPC(mrr: number, customerCount: number): number {
  if (customerCount === 0) return 0;
  return mrr / customerCount;
}

export interface MonthlyRevenue {
  month: string; // YYYY-MM
  revenue: number;
}

export function getMonthlyRevenue(invoices: Invoice[]): MonthlyRevenue[] {
  const byMonth = new Map<string, number>();

  invoices
    .filter((inv) => inv.state === "settled" && inv.settled)
    .forEach((inv) => {
      const month = inv.settled!.substring(0, 7); // YYYY-MM
      byMonth.set(month, (byMonth.get(month) ?? 0) + inv.amount);
    });

  return Array.from(byMonth.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export interface PlanBreakdown {
  plan: string;
  planName: string;
  activeCount: number;
  mrr: number;
}

export function getSubscriptionBreakdown(
  subscriptions: Subscription[],
  plans: Map<string, Plan>,
  addOns: Map<string, AddOn> = new Map()
): PlanBreakdown[] {
  const byPlan = new Map<string, { count: number; mrr: number }>();

  subscriptions
    .filter((s) => s.state === "active")
    .forEach((sub) => {
      const monthlyAmount = subscriptionMRR(sub, plans, addOns);

      const existing = byPlan.get(sub.plan) ?? { count: 0, mrr: 0 };
      byPlan.set(sub.plan, {
        count: existing.count + 1,
        mrr: existing.mrr + monthlyAmount,
      });
    });

  return Array.from(byPlan.entries())
    .map(([planHandle, data]) => ({
      plan: planHandle,
      planName: plans.get(planHandle)?.name ?? planHandle,
      activeCount: data.count,
      mrr: data.mrr,
    }))
    .sort((a, b) => b.mrr - a.mrr);
}
