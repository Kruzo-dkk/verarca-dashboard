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
export function countActiveCustomers(
  snapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): number {
  if (!customerLinks || customerLinks.size === 0) {
    return snapshots.filter((s) => s.status === "active" && s.mrr > 0).length;
  }
  return collapseLinkedSnapshots(snapshots, customerLinks).filter(
    (c) => c.active && c.mrr > 0
  ).length;
}

export interface CollapsedCustomer {
  canonicalId: string;
  mrr: number;
  active: boolean;
}

/**
 * Resolve an id (or handle) through a links map, following chains safely.
 * customerLinks maps secondary -> canonical.
 */
function resolveCanonical(
  start: string,
  links: Map<string, string> | undefined
): string {
  if (!links) return start;
  let cur = start;
  const seen = new Set<string>();
  while (links.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = links.get(cur)!;
  }
  return cur;
}

/**
 * Collapse snapshots into one logical customer per linked group, summing MRR
 * across all members. A group is "active" if ANY member is active with mrr > 0.
 *
 * @param customerLinks - secondaryCustomerId → canonicalCustomerId (stringified
 *   DB ids). Omit for identity (one CollapsedCustomer per snapshot row).
 */
export function collapseLinkedSnapshots(
  snapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): CollapsedCustomer[] {
  const buckets = new Map<string, CollapsedCustomer>();
  for (const s of snapshots) {
    const canonicalId = resolveCanonical(s.customerId, customerLinks);
    const isActive = s.status === "active" && s.mrr > 0;
    const existing = buckets.get(canonicalId);
    if (existing) {
      existing.mrr += s.mrr;
      existing.active = existing.active || isActive;
    } else {
      buckets.set(canonicalId, { canonicalId, mrr: s.mrr, active: isActive });
    }
  }
  return [...buckets.values()];
}

/**
 * Drop churned subscriptions whose customer belongs to a linked group that
 * still has an active member — if any sibling is active, the customer is not
 * churned.
 *
 * @param linkedToCanonical - linkedHandle → canonicalHandle (frisbii handles)
 * @param activeCanonicalHandles - canonical handles with at least one active member
 */
export function suppressLinkedChurn<T extends { customer: string }>(
  churnedSubs: T[],
  linkedToCanonical: Map<string, string>,
  activeCanonicalHandles: Set<string>
): T[] {
  // Only customers that belong to a linked group are eligible for suppression —
  // a single handle's own plan changes are out of scope and handled elsewhere.
  const linkedHandles = new Set<string>([
    ...linkedToCanonical.keys(),
    ...linkedToCanonical.values(),
  ]);
  return churnedSubs.filter((s) => {
    if (!linkedHandles.has(s.customer)) return true;
    return !activeCanonicalHandles.has(resolveCanonical(s.customer, linkedToCanonical));
  });
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
  /** @deprecated alias for logoChurnRate — kept for backwards compat with existing API consumers */
  churnRate: number;
  logoChurnRate: number;
  revenueChurnRate: number;
  expiredCount: number;
  activeAtStart: number;
  churnedMRR: number;
  startMRR: number;
}

/** Minimal shape required from monthly_snapshots to compute churn. */
export interface SnapshotForChurn {
  month: string; // YYYY-MM
  mrr: number;
  customer_count: number;
  churned_logos: number;
  churned_mrr: number;
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

      const expired = s.expired_date ? new Date(s.expired_date) : null;
      if (expired && expired < monthStart) return false;
      return true;
    }).length;

    // Subscriptions that expired OR cancelled within this month,
    // excluding administrative replacements
    const churnedCount = subscriptions.filter((s) => {
      if (excludedHandles?.has(s.handle)) return false;
      if (s.state === "expired" && s.expired_date) {
        const expired = new Date(s.expired_date);
        return expired >= monthStart && expired < monthEnd;
      }
      if (s.state === "cancelled" && s.cancelled_date) {
        const cancelled = new Date(s.cancelled_date);
        return cancelled >= monthStart && cancelled < monthEnd;
      }
      return false;
    }).length;

    const logoChurnRate = calculateLogoChurnRate(churnedCount, activeAtStart);

    results.push({
      month: monthKey,
      churnRate: logoChurnRate,
      logoChurnRate,
      revenueChurnRate: 0, // subscription-based input cannot compute revenue churn; prefer getMonthlyChurnFromSnapshots
      expiredCount: churnedCount,
      activeAtStart,
      churnedMRR: 0,
      startMRR: 0,
    });
  }

  return results;
}

/**
 * Compute both logo and revenue churn rates per month from `monthly_snapshots` rows.
 *
 * Each row's "start" state is taken from the prior row (ascending month order).
 * The first row falls back to a self-derived start: `mrr + churned_mrr` and
 * `customer_count + churned_logos` — imperfect but bounded.
 */
export function getMonthlyChurnFromSnapshots(
  snapshots: SnapshotForChurn[]
): MonthlyChurn[] {
  const sorted = [...snapshots].sort((a, b) => a.month.localeCompare(b.month));
  return sorted.map((snap, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const activeAtStart = prev
      ? prev.customer_count
      : snap.customer_count + snap.churned_logos;
    const startMRR = prev ? prev.mrr : snap.mrr + snap.churned_mrr;

    const logoChurnRate = calculateLogoChurnRate(snap.churned_logos, activeAtStart);
    const revenueChurnRate = calculateRevenueChurnRate(snap.churned_mrr, startMRR);

    return {
      month: snap.month,
      churnRate: logoChurnRate,
      logoChurnRate,
      revenueChurnRate,
      expiredCount: snap.churned_logos,
      activeAtStart,
      churnedMRR: snap.churned_mrr,
      startMRR,
    };
  });
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
  // Collapse linked groups first so a real-world customer with multiple handles
  // is one logical customer (summed MRR, present if any member active). This is
  // the SAME collapse used by countActiveCustomers — keeping count, churn, and
  // decomposition consistent. A linked sibling that churns while the canonical
  // stays active reads as contraction, never churn+new.
  const prev = collapseLinkedSnapshots(prevSnapshots, customerLinks);
  const curr = collapseLinkedSnapshots(currentSnapshots, customerLinks);

  const prevMap = new Map(
    prev.filter((c) => c.active).map((c) => [c.canonicalId, c.mrr])
  );
  const currMap = new Map(
    curr.map((c) => [c.canonicalId, { mrr: c.mrr, present: c.active }])
  );

  let newMRR = 0;
  let expansionMRR = 0;
  let contractionMRR = 0;
  let churnedMRR = 0;

  for (const [id, c] of currMap) {
    const prevMrr = prevMap.get(id);
    if (!c.present) {
      if (prevMrr !== undefined) churnedMRR += prevMrr;
    } else if (prevMrr === undefined) {
      newMRR += c.mrr;
    } else if (c.mrr > prevMrr) {
      expansionMRR += c.mrr - prevMrr;
    } else if (c.mrr < prevMrr) {
      contractionMRR += prevMrr - c.mrr;
    }
  }

  // Groups active last month with no snapshot row at all this month.
  for (const [id, prevMrr] of prevMap) {
    if (!currMap.has(id)) churnedMRR += prevMrr;
  }

  return {
    newMRR,
    expansionMRR,
    contractionMRR,
    churnedMRR,
    netNewMRR: newMRR + expansionMRR - contractionMRR - churnedMRR,
  };
}

/** One customer's contribution to an MRR-movement bucket. */
export interface CustomerMovement {
  canonicalId: string;
  amount: number;
}

export interface MRRMovementBreakdown {
  newCustomers: CustomerMovement[];
  expansion: CustomerMovement[];
  contraction: CustomerMovement[];
  churned: CustomerMovement[];
}

/**
 * Per-customer breakdown of the MRR waterfall (snapshot/month-over-month basis,
 * the SAME logic as decomposeMRR — so each bucket's amounts sum to the matching
 * decomposeMRR component). Linked groups collapsed to one logical customer.
 *   - newCustomers: present now, absent last month → their MRR
 *   - expansion/contraction: present both, MRR up/down → the delta
 *   - churned: present last month, absent now → MRR lost
 */
export function decomposeMRRByCustomer(
  currentSnapshots: CustomerMRRSnapshot[],
  prevSnapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): MRRMovementBreakdown {
  const prev = collapseLinkedSnapshots(prevSnapshots, customerLinks);
  const curr = collapseLinkedSnapshots(currentSnapshots, customerLinks);
  const prevMap = new Map(prev.filter((c) => c.active).map((c) => [c.canonicalId, c.mrr]));
  const currMap = new Map(curr.map((c) => [c.canonicalId, { mrr: c.mrr, present: c.active }]));

  const out: MRRMovementBreakdown = {
    newCustomers: [],
    expansion: [],
    contraction: [],
    churned: [],
  };

  for (const [id, c] of currMap) {
    const prevMrr = prevMap.get(id);
    if (!c.present) {
      if (prevMrr !== undefined) out.churned.push({ canonicalId: id, amount: prevMrr });
    } else if (prevMrr === undefined) {
      out.newCustomers.push({ canonicalId: id, amount: c.mrr });
    } else if (c.mrr > prevMrr) {
      out.expansion.push({ canonicalId: id, amount: c.mrr - prevMrr });
    } else if (c.mrr < prevMrr) {
      out.contraction.push({ canonicalId: id, amount: prevMrr - c.mrr });
    }
  }
  for (const [id, prevMrr] of prevMap) {
    if (!currMap.has(id)) out.churned.push({ canonicalId: id, amount: prevMrr });
  }
  return out;
}

/** A churned logical customer and the MRR lost (its prior-month group MRR). */
export interface ChurnedCustomer {
  canonicalId: string;
  mrr: number;
}

/**
 * The grundlag behind churn: linked-collapsed customers that were active last
 * month and are no longer active this month, with the MRR lost. Consistent with
 * decomposeMRR — the sum of these equals churnedMRR for fully-gone groups.
 */
export function getChurnedCustomers(
  currentSnapshots: CustomerMRRSnapshot[],
  prevSnapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): ChurnedCustomer[] {
  const prev = collapseLinkedSnapshots(prevSnapshots, customerLinks);
  const curr = collapseLinkedSnapshots(currentSnapshots, customerLinks);
  const currActive = new Set(
    curr.filter((c) => c.active).map((c) => c.canonicalId)
  );
  return prev
    .filter((c) => c.active && !currActive.has(c.canonicalId))
    .map((c) => ({ canonicalId: c.canonicalId, mrr: c.mrr }));
}

/** Minimal customer shape needed to determine event-based churn. */
export interface CustomerChurnState {
  id: number;
  frisbii_handle: string;
  churn_date: string | null;
  status: string;
  excluded?: boolean;
}

/** Map each customer id to its canonical customer id via confirmed links. */
export function buildIdToCanonicalId(
  customers: { id: number; frisbii_handle: string }[],
  confirmedLinks: Map<string, string>
): Map<number, number> {
  const handleToId = new Map(customers.map((c) => [c.frisbii_handle, c.id]));
  const map = new Map<number, number>();
  for (const c of customers) {
    let handle = c.frisbii_handle;
    const seen = new Set<string>();
    while (confirmedLinks.has(handle) && !seen.has(handle)) {
      seen.add(handle);
      handle = confirmedLinks.get(handle)!;
    }
    map.set(c.id, handleToId.get(handle) ?? c.id);
  }
  return map;
}

/**
 * Event-based churn: the canonical customers whose subscription ENDED within
 * [startMonth, endMonth] (close-month convention) and whose linked group has no
 * currently-active member. Returns canonical customer ids. The same definition
 * powers logo churn (count), revenue churn (their MRR), and the churned list,
 * so all three reconcile.
 *
 * @param startMonth/endMonth - inclusive YYYY-MM bounds for the churn_date
 * @param confirmedLinks - linkedHandle → canonicalHandle
 */
export function eventChurnedCanonicalIds(
  startMonth: string,
  endMonth: string,
  customers: CustomerChurnState[],
  confirmedLinks: Map<string, string>
): Set<number> {
  const handleToId = new Map(customers.map((c) => [c.frisbii_handle, c.id]));
  const canonicalIdOf = (c: CustomerChurnState): number => {
    let handle = c.frisbii_handle;
    const seen = new Set<string>();
    while (confirmedLinks.has(handle) && !seen.has(handle)) {
      seen.add(handle);
      handle = confirmedLinks.get(handle)!;
    }
    return handleToId.get(handle) ?? c.id;
  };

  const lo = `${startMonth}-01`;
  const hi = `${endMonth}-31`;
  const activeCanonical = new Set<number>();
  const churnedCanonical = new Set<number>();
  for (const c of customers) {
    if (c.excluded) continue; // test/internal accounts never count as churn
    const cid = canonicalIdOf(c);
    if (c.status === "active") activeCanonical.add(cid);
    if (c.churn_date && c.churn_date >= lo && c.churn_date <= hi) {
      churnedCanonical.add(cid);
    }
  }

  const result = new Set<number>();
  for (const cid of churnedCanonical) {
    if (!activeCanonical.has(cid)) result.add(cid); // group fully gone
  }
  return result;
}

/**
 * New logical customers this period: linked-collapsed customers active now that
 * were not active last month, with their current MRR. Symmetric to
 * getChurnedCustomers and consistent with the same collapse.
 */
export function getNewCustomers(
  currentSnapshots: CustomerMRRSnapshot[],
  prevSnapshots: CustomerMRRSnapshot[],
  customerLinks?: Map<string, string>
): ChurnedCustomer[] {
  const prev = collapseLinkedSnapshots(prevSnapshots, customerLinks);
  const curr = collapseLinkedSnapshots(currentSnapshots, customerLinks);
  const prevActive = new Set(
    prev.filter((c) => c.active).map((c) => c.canonicalId)
  );
  return curr
    .filter((c) => c.active && !prevActive.has(c.canonicalId))
    .map((c) => ({ canonicalId: c.canonicalId, mrr: c.mrr }));
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
 * Logo Churn Rate: % of customers who churned relative to the count at period start.
 * Counts every lost customer equally — including those who churned before any revenue
 * was collected (kr 0 MRR). Complements calculateRevenueChurnRate.
 */
export function calculateLogoChurnRate(
  churnedLogos: number,
  activeAtStart: number
): number {
  if (activeAtStart === 0) return 0;
  return Math.round((churnedLogos / activeAtStart) * 10000) / 100;
}

/**
 * Revenue Churn Rate: % of MRR lost from churned customers relative to the MRR
 * at period start. Customers who churned before ever generating MRR contribute 0
 * to churnedMRR by construction — so revenue churn correctly ignores them while
 * logo churn still counts them.
 */
export function calculateRevenueChurnRate(
  churnedMRR: number,
  startMRR: number
): number {
  if (startMRR === 0) return 0;
  return Math.round((churnedMRR / startMRR) * 10000) / 100;
}

/**
 * Logo (customer count) retention rate.
 * = 100 − logoChurnRate
 */
export function calculateLogoRetention(
  startCustomers: number,
  churnedCustomers: number
): number {
  if (startCustomers === 0) return 0;
  return Math.round((100 - calculateLogoChurnRate(churnedCustomers, startCustomers)) * 100) / 100;
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
