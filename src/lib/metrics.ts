import type { Subscription, Invoice, Plan } from "./frisbii";

/**
 * Normalize a plan amount to its monthly equivalent based on billing interval.
 *
 * @param amount - The plan amount per billing cycle (in minor units, e.g. øre)
 * @param intervalLength - Number of months per billing cycle (1 = monthly, 3 = quarterly, 12 = annual)
 * @returns The monthly equivalent amount in minor units (unrounded for aggregation accuracy)
 */
export function normalizeToMonthly(
  amount: number,
  intervalLength: number
): number {
  if (intervalLength === 1) return amount;
  if (!intervalLength || intervalLength <= 0) return amount;
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
 * Calculate the monthly recurring revenue for a single subscription.
 *
 * MRR = (plan list price + add-on amounts) / billing interval in months
 *
 * Uses the plan's base amount (not sub.amount which may include discounts)
 * to follow standard SaaS MRR convention: MRR represents list-price revenue.
 *
 * @param addOnTotals - Map of subscription handle → total add-on amount per billing period
 */
function subscriptionMRR(
  sub: Subscription,
  plans: Map<string, Plan>,
  addOnTotals: Map<string, number>
): number {
  const plan = plans.get(sub.plan);
  const intervalLength = plan?.interval_length ?? 12;
  const planAmount = plan?.amount ?? 0;
  const quantity = sub.quantity || 1;

  // Plan base amount normalized to monthly
  let total = normalizeToMonthly(planAmount * quantity, intervalLength);

  // Add-on amounts (already per-billing-period from the subscription endpoint)
  const addOnTotal = addOnTotals.get(sub.handle) ?? 0;
  if (addOnTotal > 0) {
    total += normalizeToMonthly(addOnTotal, intervalLength);
  }

  return total;
}

export function calculateMRR(
  subscriptions: Subscription[],
  plans: Map<string, Plan>,
  addOnTotals: Map<string, number> = new Map()
): number {
  return subscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => sum + subscriptionMRR(sub, plans, addOnTotals), 0);
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
  addOnTotals: Map<string, number> = new Map()
): number {
  const newMRR = newSubscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => sum + subscriptionMRR(sub, plans, addOnTotals), 0);

  const churnedMRR = cancelledSubscriptions.reduce(
    (sum, sub) => sum + subscriptionMRR(sub, plans, addOnTotals),
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
  addOnTotals: Map<string, number> = new Map()
): PlanBreakdown[] {
  const byPlan = new Map<string, { count: number; mrr: number }>();

  subscriptions
    .filter((s) => s.state === "active")
    .forEach((sub) => {
      const monthlyAmount = subscriptionMRR(sub, plans, addOnTotals);

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
