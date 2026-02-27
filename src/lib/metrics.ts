import type { Subscription, Invoice, Plan } from "./frisbii";

/**
 * Normalize a plan amount to its monthly equivalent based on billing interval.
 *
 * Industry best practice (Stripe, ChartMogul, Baremetrics):
 * - Divide the cycle amount by the interval length in months
 * - Keep full precision during aggregation to avoid cumulative rounding drift
 * - Round only at display time (handled by formatCurrency in components)
 *
 * @param amount - The plan amount per billing cycle (in minor units, e.g. cents)
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

export function calculateMRR(
  subscriptions: Subscription[],
  plans: Map<string, Plan>
): number {
  return subscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => {
      const plan = plans.get(sub.plan);
      const intervalLength = plan?.interval_length ?? 1;
      const amount = sub.amount ?? plan?.amount ?? 0;
      return sum + normalizeToMonthly(amount * (sub.quantity || 1), intervalLength);
    }, 0);
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
  plans: Map<string, Plan>
): number {
  const newMRR = newSubscriptions
    .filter((s) => s.state === "active")
    .reduce((sum, sub) => {
      const plan = plans.get(sub.plan);
      const intervalLength = plan?.interval_length ?? 1;
      const amount = sub.amount ?? plan?.amount ?? 0;
      return sum + normalizeToMonthly(amount * (sub.quantity || 1), intervalLength);
    }, 0);

  const churnedMRR = cancelledSubscriptions.reduce((sum, sub) => {
    const plan = plans.get(sub.plan);
    const intervalLength = plan?.interval_length ?? 1;
    const amount = sub.amount ?? plan?.amount ?? 0;
    return sum + normalizeToMonthly(amount * (sub.quantity || 1), intervalLength);
  }, 0);

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
  plans: Map<string, Plan>
): PlanBreakdown[] {
  const byPlan = new Map<string, { count: number; mrr: number }>();

  subscriptions
    .filter((s) => s.state === "active")
    .forEach((sub) => {
      const plan = plans.get(sub.plan);
      const intervalLength = plan?.interval_length ?? 1;
      const amount = sub.amount ?? plan?.amount ?? 0;
      const monthlyAmount = normalizeToMonthly(amount * (sub.quantity || 1), intervalLength);

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
