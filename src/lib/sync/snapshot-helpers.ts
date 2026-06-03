import type { Subscription } from "@/lib/frisbii";

/**
 * Whether a subscription was active at any point during the given month.
 *
 * Single source of truth shared by the monthly snapshot aggregation
 * (sync-customer-snapshots, backfill-history) and discount attribution
 * (sync-discounts) so they never diverge on which subs count.
 *
 * Rules:
 *  - Must have been activated (or created) on/before the last day of the month.
 *  - A currently-active subscription always counts.
 *  - A non-active subscription must carry an end date proving it ran into this
 *    month — a non-active sub with no termination record is a "ghost" and is
 *    excluded (otherwise it would inflate every historical month forever).
 *  - It is excluded if it ended before the month started.
 */
export function wasActiveDuringMonth(sub: Subscription, month: string): boolean {
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const activatedDate = (sub.activated || sub.created)?.slice(0, 10);
  if (!activatedDate || activatedDate > monthEnd) return false;

  // Currently active subscriptions are always included.
  if (sub.state === "active") return true;

  // Non-active subscriptions need an end date to prove they ran into this month
  // (no end date + not active = ghost subscription).
  const endDate = (sub.expired_date || sub.cancelled_date)?.slice(0, 10) ?? null;
  if (!endDate) return false;
  if (endDate < monthStart) return false;

  return true;
}
