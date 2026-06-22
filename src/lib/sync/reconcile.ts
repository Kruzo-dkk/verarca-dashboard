import { createAdminClient } from "@/lib/supabase/admin";
import {
  collapseLinkedSnapshots,
  buildActiveCountByCanonical,
  type CustomerMRRSnapshot,
} from "@/lib/metrics";
import { getConfirmedLinks } from "./get-customer-links";

/**
 * The COLLAPSED customer-MRR sum for a month — the same linked-group collapse
 * (re-signup top-K + identical-duplicate de-dup by cvr/plan/amount) that produces
 * `monthly_snapshots.mrr`. This is the single source for MRR reconciliation so the
 * validate-sync audit check and the Data Quality reconciliation card cannot drift.
 * A raw `SUM(customer_snapshots.mrr)` diverges by exactly what the collapse removes.
 */
export async function collapsedCustomerMRR(month: string): Promise<number> {
  const supabase = createAdminClient();
  const [{ data: snaps }, { data: customerRows }, confirmedLinks] = await Promise.all([
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, status, plan_handle")
      .eq("month", month),
    supabase
      .from("customers")
      .select("id, frisbii_handle, status, cvr")
      .eq("excluded", false),
    getConfirmedLinks(),
  ]);

  const customers = customerRows ?? [];
  const handleToId = new Map(customers.map((c) => [c.frisbii_handle, String(c.id)]));
  const customerLinks = new Map<string, string>();
  for (const [linked, canon] of confirmedLinks) {
    const oldId = handleToId.get(linked);
    const newId = handleToId.get(canon);
    if (oldId && newId && oldId !== newId) customerLinks.set(oldId, newId);
  }
  const links = customerLinks.size > 0 ? customerLinks : undefined;
  const activeCount = buildActiveCountByCanonical(customers, confirmedLinks);
  const cvrById = new Map(customers.map((c) => [String(c.id), c.cvr ?? null]));

  const rows: CustomerMRRSnapshot[] = (snaps ?? []).map((r) => ({
    customerId: String(r.customer_id),
    mrr: r.mrr,
    status: r.status,
    planHandle: r.plan_handle ?? "",
    cvr: cvrById.get(String(r.customer_id)) ?? null,
  }));

  return collapseLinkedSnapshots(rows, links, activeCount).reduce((s, c) => s + c.mrr, 0);
}
