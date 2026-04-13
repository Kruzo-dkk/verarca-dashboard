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

/**
 * Count active customers from snapshots.
 *
 * Only counts customers with status "active" AND mrr > 0.
 * This excludes free/zero-MRR customers and churned customers,
 * ensuring the count aligns with revenue-bearing customers used
 * in ARPA and other per-customer metrics.
 */
export function countActiveCustomers(snapshots: CustomerMRRSnapshot[]): number {
  return snapshots.filter((s) => s.status === "active" && s.mrr > 0).length;
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

export interface MonthlyChurn {
  month: string; // YYYY-MM
  churnRate: number;
  expiredCount: number;
  activeAtStart: number;
}

/**
 * Compute per-month churn rates from subscription data.
 *
 * For each month we determine:
 *   - activeAtStart: subscriptions that were active at the beginning of the month
 *     (activated before month start AND not expired before month start)
 *   - expiredCount: subscriptions that expired within the month
 *   - churnRate: expiredCount / activeAtStart * 100
 */
export function getMonthlyChurn(
  subscriptions: Subscription[],
  months: number = 12,
  excludedHandles?: Set<string>
): MonthlyChurn[] {
  const now = new Date();
  const results: MonthlyChurn[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;

    // Subscriptions active at the start of this month:
    // activated before monthStart AND (not expired OR expired on/after monthStart)
    const activeAtStart = subscriptions.filter((s) => {
      const activated = s.activated ? new Date(s.activated) : null;
      const created = new Date(s.created);
      const startDate = activated ?? created;
      if (startDate >= monthStart) return false;

      const expired = s.expired ? new Date(s.expired) : null;
      if (expired && expired < monthStart) return false;
      return true;
    }).length;

    // Subscriptions that expired OR cancelled within this month,
    // excluding administrative replacements
    const churnedCount = subscriptions.filter((s) => {
      if (excludedHandles?.has(s.handle)) return false;
      if (s.state === "expired" && s.expired) {
        const expired = new Date(s.expired);
        return expired >= monthStart && expired < monthEnd;
      }
      if (s.state === "cancelled" && s.cancelled) {
        const cancelled = new Date(s.cancelled);
        return cancelled >= monthStart && cancelled < monthEnd;
      }
      return false;
    }).length;

    const churnRate = activeAtStart > 0 ? (churnedCount / activeAtStart) * 100 : 0;

    results.push({
      month: monthKey,
      churnRate: Math.round(churnRate * 100) / 100,
      expiredCount: churnedCount, // backwards compat
      activeAtStart,
    });
  }

  return results;
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

// ─── M&A Metric Types ──────────────────────────────────────────

export interface MRRDecomposition {
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnedMRR: number;
  netNewMRR: number;
}

export interface CustomerMRRSnapshot {
  customerId: string;
  mrr: number;
  status: string;
  planHandle: string;
}

// ─── M&A Metric Functions ──────────────────────────────────────

/**
 * Decompose MRR changes between two months into components.
 *
 * - New MRR: customers present in current but not in previous
 * - Churned MRR: customers present in previous but not in current
 * - Expansion MRR: existing customers whose MRR increased
 * - Contraction MRR: existing customers whose MRR decreased
 *
 * @param customerLinks - optional Map of oldCustomerId → newCustomerId for
 *   subscription replacements. When provided, a "new" customer that is linked
 *   to a "churned" customer is treated as continuity (expansion/contraction)
 *   rather than churn+new.
 */
export function decomposeMRR(
  currentSnapshots: CustomerMRRSnapshot[],
  prevSnapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): MRRDecomposition {
  // Build reverse map: newId -> oldId
  const newToOld = new Map<string, string>();
  if (customerLinks) {
    for (const [oldId, newId] of customerLinks) {
      newToOld.set(newId, oldId);
    }
  }

  const prevMap = new Map(prevSnapshots.map(s => [s.customerId, s.mrr]));
  const currMap = new Map(currentSnapshots.map(s => [s.customerId, s.mrr]));

  let newMRR = 0;
  let expansionMRR = 0;
  let contractionMRR = 0;
  let churnedMRR = 0;

  // Track which previous-month customer IDs have been accounted for
  const handledPrevIds = new Set<string>();

  // Check current customers against previous
  for (const [id, currMrr] of currMap) {
    // Check direct match, then linked old ID
    const linkedOldId = newToOld.get(id);
    const prevMrr = prevMap.get(id) ?? (linkedOldId ? prevMap.get(linkedOldId) : undefined);

    if (prevMrr === undefined) {
      newMRR += currMrr;
    } else if (currMrr > prevMrr) {
      expansionMRR += currMrr - prevMrr;
    } else if (currMrr < prevMrr) {
      contractionMRR += prevMrr - currMrr;
    }

    handledPrevIds.add(id);
    if (linkedOldId) handledPrevIds.add(linkedOldId);
  }

  // Check for churned customers (in previous but not in current or linked)
  for (const [id, prevMrr] of prevMap) {
    if (!handledPrevIds.has(id) && !currMap.has(id)) {
      churnedMRR += prevMrr;
    }
  }

  return {
    newMRR,
    expansionMRR,
    contractionMRR,
    churnedMRR,
    netNewMRR: newMRR + expansionMRR - contractionMRR - churnedMRR,
  };
}

/**
 * Net Revenue Retention (NRR).
 * Measures revenue retained + expanded from existing customers over a period.
 *
 * NRR = (End MRR from customers who existed at Start) / Start MRR × 100
 *
 * > 100% means expansion exceeds churn. Best-in-class SaaS: 120%+.
 */
export function calculateNRR(
  startMRR: number,
  endMRRExistingCustomers: number
): number {
  if (startMRR === 0) return 0;
  return Math.round((endMRRExistingCustomers / startMRR) * 10000) / 100;
}

/**
 * Gross Revenue Retention (GRR).
 * Measures revenue retained from existing customers, excluding expansion.
 *
 * GRR = (Start MRR - Contraction - Churned) / Start MRR × 100
 *
 * Always ≤ 100%. Best-in-class SaaS: 90%+.
 */
export function calculateGRR(
  startMRR: number,
  contractionMRR: number,
  churnedMRR: number
): number {
  if (startMRR === 0) return 0;
  const retained = startMRR - contractionMRR - churnedMRR;
  return Math.round((Math.max(0, retained) / startMRR) * 10000) / 100;
}

/**
 * SaaS Quick Ratio.
 * Measures growth efficiency: how much new/expansion MRR vs. lost MRR.
 *
 * Quick Ratio = (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)
 *
 * > 4 = excellent, > 2 = good, < 1 = shrinking.
 */
export function calculateQuickRatio(
  newMRR: number,
  expansionMRR: number,
  churnedMRR: number,
  contractionMRR: number
): number {
  const lost = churnedMRR + contractionMRR;
  if (lost === 0) return newMRR + expansionMRR > 0 ? Infinity : 0;
  return Math.round(((newMRR + expansionMRR) / lost) * 100) / 100;
}

/**
 * Revenue concentration: what % of total MRR comes from the top N customers.
 *
 * High concentration (>30% from top 10) = risk flag for acquirers.
 */
export function calculateConcentration(
  customerMRRs: number[],
  topN: number = 10
): number {
  if (customerMRRs.length === 0) return 0;
  const total = customerMRRs.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const sorted = [...customerMRRs].sort((a, b) => b - a);
  const topSum = sorted.slice(0, topN).reduce((a, b) => a + b, 0);
  return Math.round((topSum / total) * 10000) / 100;
}

/**
 * Customer Lifetime Value (LTV).
 *
 * When churn rate > 0: LTV = ARPA / Monthly Churn Rate
 * When churn rate = 0: LTV = ARPA × MAX_LIFETIME_MONTHS (capped at 60 months)
 *
 * The 60-month cap is a conservative, investor-standard assumption for
 * early-stage SaaS with zero observed churn.
 *
 * Both ARPA and result are in minor units (øre).
 */
const MAX_LIFETIME_MONTHS = 60;

export function calculateLTV(arpa: number, monthlyChurnRate: number): number {
  if (arpa <= 0) return 0;
  if (monthlyChurnRate <= 0) return Math.round(arpa * MAX_LIFETIME_MONTHS);
  // monthlyChurnRate is a percentage (e.g., 2.5 = 2.5%)
  return Math.round(arpa / (monthlyChurnRate / 100));
}

/**
 * Revenue per employee.
 * ARR (minor units) / employee count.
 */
export function calculateRevenuePerEmployee(
  arr: number,
  employeeCount: number
): number {
  if (employeeCount === 0) return 0;
  return Math.round(arr / employeeCount);
}

/**
 * Logo (customer count) retention rate.
 * = (1 - churned / start) × 100
 */
export function calculateLogoRetention(
  startCustomers: number,
  churnedCustomers: number
): number {
  if (startCustomers === 0) return 0;
  return Math.round((1 - churnedCustomers / startCustomers) * 10000) / 100;
}

/**
 * MRR growth rate (month-over-month or year-over-year).
 * = ((current - previous) / |previous|) × 100
 */
export function calculateMRRGrowth(
  currentMRR: number,
  previousMRR: number
): number {
  if (previousMRR === 0) return currentMRR > 0 ? 100 : 0;
  return Math.round(((currentMRR - previousMRR) / Math.abs(previousMRR)) * 10000) / 100;
}
