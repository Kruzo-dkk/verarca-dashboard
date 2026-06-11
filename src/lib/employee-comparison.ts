import { daysSince } from "@/lib/period";
import type { EmployeeComparison } from "@/lib/types/sales";

/** Minimal per-deal shape needed for the comparison (a subset of the API's rawDeals). */
export interface ComparableDeal {
  ownerId: string | null;
  amount: number; // DKK øre
  probability: number; // 0–1 decimal
  isClosed: boolean;
  isWon: boolean;
  createdDate: string | null;
}

/** Per-owner activity total (this month) keyed by ownerId. */
export interface OwnerActivityTotal {
  ownerId: string;
  ownerName: string;
  totalActivities: number;
}

/**
 * Aggregate sales metrics per owner. An owner appears if they have any activity
 * OR any deal. Pure and deterministic — `now` is injectable for the age math.
 * Deals with no ownerId are ignored (they cannot be attributed to a person).
 * Sorted by open pipeline value, descending.
 */
export function computeEmployeeComparison(
  deals: ComparableDeal[],
  activities: OwnerActivityTotal[],
  resolveName: (ownerId: string) => string,
  now: number = Date.now()
): EmployeeComparison[] {
  // Seed the owner set from both sources so neither is lost.
  const ownerIds = new Set<string>();
  for (const a of activities) ownerIds.add(a.ownerId);
  for (const d of deals) if (d.ownerId) ownerIds.add(d.ownerId);

  const activityById = new Map(activities.map((a) => [a.ownerId, a]));

  const rows: EmployeeComparison[] = [];
  for (const ownerId of ownerIds) {
    const ownerDeals = deals.filter((d) => d.ownerId === ownerId);
    const openDeals = ownerDeals.filter((d) => !d.isClosed);
    const closedDeals = ownerDeals.filter((d) => d.isClosed);
    const wonDeals = closedDeals.filter((d) => d.isWon);

    const openPipelineValue = openDeals.reduce((s, d) => s + d.amount, 0);
    const weightedPipeline = openDeals.reduce(
      (s, d) => s + Math.round(d.amount * d.probability),
      0
    );

    // Average age over open deals that have a createdate; null when none do.
    const ages = openDeals
      .map((d) => daysSince(d.createdDate, now))
      .filter((n): n is number => n !== null);
    const avgDealAgeDays =
      ages.length > 0
        ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
        : null;

    // 0–1 decimal; 0 (not NaN) when the owner has no closed deals.
    const winRate =
      closedDeals.length > 0 ? wonDeals.length / closedDeals.length : 0;

    const activity = activityById.get(ownerId);

    rows.push({
      ownerId,
      ownerName: activity?.ownerName ?? resolveName(ownerId),
      openDealCount: openDeals.length,
      openPipelineValue,
      weightedPipeline,
      avgDealAgeDays,
      dealsWon: wonDeals.length,
      mrrClosed: wonDeals.reduce((s, d) => s + d.amount, 0),
      winRate,
      totalActivities: activity?.totalActivities ?? 0,
    });
  }

  return rows.sort((a, b) => b.openPipelineValue - a.openPipelineValue);
}
