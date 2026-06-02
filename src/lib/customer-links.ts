import type { CustomerSummary, LinkedMember, LinkedGroup } from "@/lib/types/report";

/**
 * A CustomerSummary plus the fields needed to collapse linked groups.
 * canonicalId is the DB id of the group's canonical customer.
 */
export interface CustomerRowForCollapse extends CustomerSummary {
  frisbiiHandle: string;
  startDate: string | null;
  canonicalId: number;
}

/**
 * Map every customer id to its canonical customer id by resolving the
 * confirmed-link chain (linkedHandle -> canonicalHandle). Customers with no
 * link map to themselves.
 */
export function buildCanonicalIdMap(
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
 * Collapse per-handle rows into one row per canonical customer: sum MRR, count
 * as one logo, attach each member's individual contribution. Solo customers get
 * linkedCount: 1 and no members. Sorted by summed MRR descending.
 */
export function collapseCustomerSummaries(
  rows: CustomerRowForCollapse[]
): CustomerSummary[] {
  const groups = new Map<number, CustomerRowForCollapse[]>();
  for (const row of rows) {
    const bucket = groups.get(row.canonicalId);
    if (bucket) bucket.push(row);
    else groups.set(row.canonicalId, [row]);
  }

  const result: CustomerSummary[] = [];
  for (const [canonicalId, members] of groups) {
    if (members.length === 1) {
      result.push(toSummary(members[0], { linkedCount: 1 }));
      continue;
    }
    const base =
      members.find((m) => m.id === canonicalId) ??
      members.find((m) => m.status === "active") ??
      members[0];
    const summedMrr = members.reduce((sum, m) => sum + m.mrr, 0);
    const anyActive = members.some((m) => m.status === "active");
    result.push(
      toSummary(base, {
        mrr: summedMrr,
        status: anyActive ? "active" : base.status,
        linkedCount: members.length,
        linkedMembers: members.map(toLinkedMember),
      })
    );
  }
  return result.sort((a, b) => b.mrr - a.mrr);
}

/**
 * Build the linked-group block for the single-customer endpoint, or null when
 * the customer stands alone. requestedHandle is the handle whose detail page is
 * open (canonical or a secondary).
 */
export function buildLinkedGroup(
  members: LinkedMember[],
  canonicalHandle: string,
  requestedHandle: string
): LinkedGroup | null {
  if (members.length <= 1) return null;
  return {
    canonicalHandle,
    isCanonical: requestedHandle === canonicalHandle,
    members,
    activeSubscriptionCount: members.filter((m) => m.status === "active").length,
    totalMrr: members.reduce((sum, m) => sum + m.mrr, 0),
  };
}

function toSummary(
  row: CustomerRowForCollapse,
  overrides: Partial<CustomerSummary>
): CustomerSummary {
  // Drop the collapse-only fields; keep the CustomerSummary shape.
  const { frisbiiHandle: _h, startDate: _s, canonicalId: _c, ...summary } = row;
  return { ...summary, ...overrides };
}

function toLinkedMember(row: CustomerRowForCollapse): LinkedMember {
  return {
    id: row.id,
    name: row.name,
    frisbiiHandle: row.frisbiiHandle,
    status: row.status,
    mrr: row.mrr,
    plan: row.plan,
    startDate: row.startDate,
  };
}
