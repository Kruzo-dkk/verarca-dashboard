import {
  calculateARR,
  calculateARPC,
  calculateNRR,
  calculateGRR,
  calculateQuickRatio,
  calculateConcentration,
  calculateLogoRetention,
  calculateMRRGrowth,
  countActiveCustomers,
  collapseLinkedSnapshots,
  buildActiveCountByCanonical,
  buildIdToCanonicalId,
  eventChurnedCanonicalIds,
  decomposeMRR,
  type CustomerMRRSnapshot,
  type CustomerChurnState,
} from "@/lib/metrics";

export interface MonthlyMetricsInput {
  month: string; // YYYY-MM
  currentSnapshots: CustomerMRRSnapshot[];
  prevSnapshots: CustomerMRRSnapshot[];
  /** All non-excluded customers (id, frisbii_handle, churn_date, status). */
  customers: CustomerChurnState[];
  /** Confirmed links: linkedHandle → canonicalHandle. */
  confirmedLinks: Map<string, string>;
  /** Count of subscriptions created this month (isCreatedInMonth). */
  newLogos: number;
  /** Previous month's stored monthly_snapshots.mrr (for MoM growth). */
  prevMonthMRR: number | null;
  /** Same-month-last-year stored monthly_snapshots.mrr (for YoY growth). */
  prevYearMRR: number | null;
}

export interface MonthlyMetrics {
  mrr: number;
  arr: number;
  netNewMRR: number;
  newMRR: number;
  expansionMRR: number;
  contractionMRR: number;
  churnedMRR: number;
  churnedMrrEvent: number;
  nrr: number;
  grr: number;
  logoRetention: number;
  quickRatio: number | null;
  customerCount: number;
  newLogos: number;
  churnedLogos: number;
  arpa: number;
  top10Concentration: number;
  mrrGrowthMoM: number | null;
  mrrGrowthYoY: number | null;
}

/**
 * Single source of truth for a month's aggregate metrics — used by BOTH
 * `syncMonthlySnapshot` (live cron) and `backfillHistory` (historic). Keeps the
 * two paths from drifting (they previously diverged on `prevCustomerCount`).
 *
 * Linked groups are collapsed (one logical customer, top-K MRR); churn is
 * event-based for `churnedMrrEvent`/`churnedLogos` and snapshot-based for
 * `churnedMRR` (the waterfall).
 */
export function computeMonthlyMetrics(input: MonthlyMetricsInput): MonthlyMetrics {
  const {
    month,
    currentSnapshots,
    prevSnapshots,
    customers,
    confirmedLinks,
    newLogos,
    prevMonthMRR,
    prevYearMRR,
  } = input;

  // secondaryId → canonicalId (stringified DB ids)
  const handleToId = new Map(customers.map((c) => [c.frisbii_handle, String(c.id)]));
  const customerLinks = new Map<string, string>();
  for (const [linked, canon] of confirmedLinks) {
    const oldId = handleToId.get(linked);
    const newId = handleToId.get(canon);
    if (oldId && newId && oldId !== newId) customerLinks.set(oldId, newId);
  }
  const links = customerLinks.size > 0 ? customerLinks : undefined;

  const activeCount = buildActiveCountByCanonical(customers, confirmedLinks);

  // MRR (top-K per group so re-signups don't inflate) + headline metrics.
  const mrr = collapseLinkedSnapshots(currentSnapshots, links, activeCount).reduce(
    (sum, c) => sum + c.mrr,
    0
  );
  const arr = calculateARR(mrr);
  const customerCount = countActiveCustomers(currentSnapshots, links, activeCount);
  const arpa = Math.round(calculateARPC(mrr, customerCount));

  // Event-based churn (close-month): subscription ended this month, group gone.
  const churnedCanonicalIds = eventChurnedCanonicalIds(month, month, customers, confirmedLinks);
  const idToCanonicalId = buildIdToCanonicalId(customers, confirmedLinks);
  const churnedMrrEvent = currentSnapshots.reduce((sum, s) => {
    const id = Number(s.customerId);
    const cid = idToCanonicalId.get(id) ?? id;
    return churnedCanonicalIds.has(cid) ? sum + s.mrr : sum;
  }, 0);

  const decomposition = decomposeMRR(currentSnapshots, prevSnapshots, links, activeCount);

  // Retention.
  const prevMRR = prevSnapshots.reduce((sum, s) => sum + s.mrr, 0);
  const prevCustomerIds = new Set(prevSnapshots.map((s) => s.customerId));
  const endMRRExisting = currentSnapshots
    .filter((s) => prevCustomerIds.has(s.customerId))
    .reduce((sum, s) => sum + s.mrr, 0);
  const nrr = calculateNRR(prevMRR, endMRRExisting);
  const grr = calculateGRR(prevMRR, decomposition.contractionMRR, decomposition.churnedMRR);

  const quickRatio = calculateQuickRatio(
    decomposition.newMRR,
    decomposition.expansionMRR,
    decomposition.churnedMRR,
    decomposition.contractionMRR
  );

  const top10Concentration = calculateConcentration(
    currentSnapshots.filter((s) => s.mrr > 0).map((s) => s.mrr),
    10
  );

  const churnedLogos = churnedCanonicalIds.size;
  const prevCustomerCount = countActiveCustomers(prevSnapshots, links, activeCount);
  const logoRetention = calculateLogoRetention(prevCustomerCount, churnedLogos);

  return {
    mrr,
    arr,
    netNewMRR: decomposition.netNewMRR,
    newMRR: decomposition.newMRR,
    expansionMRR: decomposition.expansionMRR,
    contractionMRR: decomposition.contractionMRR,
    churnedMRR: decomposition.churnedMRR,
    churnedMrrEvent,
    nrr,
    grr,
    logoRetention,
    quickRatio: Number.isFinite(quickRatio) ? quickRatio : null,
    customerCount,
    newLogos,
    churnedLogos,
    arpa,
    top10Concentration,
    mrrGrowthMoM: prevMonthMRR != null ? calculateMRRGrowth(mrr, prevMonthMRR) : null,
    mrrGrowthYoY: prevYearMRR != null ? calculateMRRGrowth(mrr, prevYearMRR) : null,
  };
}
