/**
 * Committed MRR calculations.
 *
 * Key insight: Verarca's current MRR is computed from list prices.
 * The "billed MRR" is what customers actually pay after discounts.
 * The "discount delta" is the gap that closes when discounts expire.
 *
 * Terminology:
 *   - List Price MRR = current MRR (already list-price based)
 *   - Billed MRR = List Price MRR - total active discount impacts
 *   - Discount Delta = List Price MRR - Billed MRR
 *   - Upcoming Expirations = discount impacts grouped by month they expire
 */

export interface DiscountSnapshotRow {
  monthly_impact: number;     // DKK øre
  discount_name: string | null;
  discount_percentage: number | null;
  discount_type: string;
  expires_at: string | null;
  subscription_handle: string;
  customer_id: number | null;
}

export interface CommittedMRRResult {
  listPriceMRR: number;      // = current MRR (already list-price based), DKK øre
  billedMRR: number;         // = listPriceMRR - total active discounts, DKK øre
  totalDiscountImpact: number; // total monthly discount across all subscriptions
  discountCount: number;      // number of active discounts
  upcomingExpirations: DiscountExpiration[];
}

export interface DiscountExpiration {
  month: string;             // YYYY-MM when discount expires
  upliftAmount: number;      // DKK øre that will be recovered
  discountCount: number;     // number of discounts expiring
}

/**
 * Compute committed MRR metrics from the current MRR and discount snapshots.
 */
export function computeCommittedMRR(
  listPriceMRR: number,
  discountSnapshots: DiscountSnapshotRow[]
): CommittedMRRResult {
  // Total monthly discount impact
  const totalDiscountImpact = discountSnapshots.reduce(
    (sum, d) => sum + (d.monthly_impact || 0),
    0
  );

  const billedMRR = Math.max(0, listPriceMRR - totalDiscountImpact);

  // Group expiring discounts by month
  const expirationMap = new Map<string, { amount: number; count: number }>();

  for (const d of discountSnapshots) {
    if (!d.expires_at) continue;

    // Extract YYYY-MM from ISO date
    const expiresMonth = d.expires_at.substring(0, 7);
    const existing = expirationMap.get(expiresMonth) ?? {
      amount: 0,
      count: 0,
    };
    expirationMap.set(expiresMonth, {
      amount: existing.amount + (d.monthly_impact || 0),
      count: existing.count + 1,
    });
  }

  const upcomingExpirations: DiscountExpiration[] = Array.from(
    expirationMap.entries()
  )
    .map(([month, data]) => ({
      month,
      upliftAmount: data.amount,
      discountCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    listPriceMRR,
    billedMRR,
    totalDiscountImpact,
    discountCount: discountSnapshots.length,
    upcomingExpirations,
  };
}
