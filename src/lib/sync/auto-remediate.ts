import { createAdminClient } from "@/lib/supabase/admin";
import { listSubscriptions } from "@/lib/frisbii";
import { getConfirmedLinks } from "./get-customer-links";
import { duplicateActiveSubGroups } from "./validate-sync";
import { syncLog } from "./logger";
import type { SyncModuleResult } from "./types";

export interface RemediationAction {
  type: "exclude_duplicate" | "exclusion_delete_recreate";
  target: string;
  detail: string;
}

/**
 * Auto-resolve the data-quality issues the audit surfaces, so the dashboard
 * self-heals without human involvement. Every action is returned (and logged to
 * the `auto-remediate` sync_runs row's metadata) so it stays fully trackable.
 *
 * Runs AFTER detect-customer-links and BEFORE the snapshots are (re)built, so the
 * cleaned state flows straight into customer_snapshots / monthly_snapshots and the
 * subsequent validateSync passes.
 *
 * 1. Duplicate active subscriptions — the SAME legal entity (cvr) with two active
 *    subs on the same plan at the same amount is a duplicate registration. The
 *    MRR collapse already counts it once; here we exclude the non-canonical
 *    account(s) so the audit clears and the snapshot rows are pruned. (The
 *    customer may still be double-billed in Frisbii — that's logged for cleanup.)
 * 2. Delete/recreate — a cancelled+recreated subscription gets a
 *    subscription_exclusion linking the ended handle to its active replacement,
 *    so churn isn't double-counted.
 */
export async function autoRemediate(month: string): Promise<SyncModuleResult> {
  const supabase = createAdminClient();
  const actions: RemediationAction[] = [];

  // ── 1. Duplicate active subscriptions (same cvr + plan + amount) ──────────
  const [{ data: snaps }, { data: custRows }, confirmedLinks] = await Promise.all([
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, plan_handle")
      .eq("month", month)
      .eq("status", "active"),
    supabase.from("customers").select("id, frisbii_handle, cvr").eq("excluded", false),
    getConfirmedLinks(),
  ]);

  const byId = new Map((custRows ?? []).map((c) => [c.id, c]));
  const handleToId = new Map((custRows ?? []).map((c) => [c.frisbii_handle, c.id]));
  const rows = (snaps ?? [])
    .map((s) => {
      const c = byId.get(s.customer_id);
      return c
        ? { frisbiiHandle: c.frisbii_handle, cvr: c.cvr ?? null, planHandle: s.plan_handle, mrr: s.mrr }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const dupeGroups = duplicateActiveSubGroups(rows, confirmedLinks).filter((g) => g.sameCvr);
  for (const g of dupeGroups) {
    const dupHandles = g.handles.filter((h) => h !== g.canonicalHandle);
    if (dupHandles.length === 0) continue;
    const dupIds = dupHandles
      .map((h) => handleToId.get(h))
      .filter((x): x is number => x != null);

    await supabase.from("customers").update({ excluded: true }).in("frisbii_handle", dupHandles);
    if (dupIds.length > 0) {
      await supabase.from("customer_snapshots").delete().in("customer_id", dupIds);
    }
    actions.push({
      type: "exclude_duplicate",
      target: g.canonicalHandle,
      detail: `excluded duplicate ${dupHandles.join(", ")} (cvr ${g.cvrs.join("/")}, mrr ${g.mrr}) — cancel the duplicate in Frisbii`,
    });
    syncLog.info(
      `[auto-remediate] duplicate: excluded ${dupHandles.join(", ")} → canonical ${g.canonicalHandle}`
    );
  }

  // ── 2. Delete/recreate → subscription_exclusion (replacement) ─────────────
  const allSubs = await listSubscriptions();
  const byCustomer = new Map<string, typeof allSubs>();
  for (const s of allSubs) {
    const list = byCustomer.get(s.customer) ?? [];
    list.push(s);
    byCustomer.set(s.customer, list);
  }
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: existingExcl } = await supabase
    .from("subscription_exclusions")
    .select("subscription_handle");
  const alreadyExcluded = new Set((existingExcl ?? []).map((e) => e.subscription_handle));

  for (const [customer, subs] of byCustomer) {
    const active = subs.find((s) => s.state === "active");
    if (!active) continue;
    const ended = subs.filter((s) => {
      if (s.state === "active") return false;
      const endDate = (s.expired_date || s.cancelled_date)?.slice(0, 10);
      return !!endDate && endDate >= ninetyDaysAgo && !alreadyExcluded.has(s.handle);
    });
    for (const e of ended) {
      await supabase.from("subscription_exclusions").upsert(
        {
          subscription_handle: e.handle,
          customer_handle: customer,
          replacement_subscription_handle: active.handle,
          reason: "auto: delete/recreate (subscription replaced)",
          excluded_by: "system:auto-remediate",
        },
        { onConflict: "subscription_handle" }
      );
      actions.push({
        type: "exclusion_delete_recreate",
        target: customer,
        detail: `${e.handle} → replaced by ${active.handle}`,
      });
      syncLog.info(
        `[auto-remediate] delete/recreate: ${e.handle} replaced by ${active.handle} (${customer})`
      );
    }
  }

  syncLog.info(`[auto-remediate] applied ${actions.length} remediation(s) for ${month}`);
  return {
    recordsFetched: null,
    recordsUpserted: actions.length,
    metadata: { actions },
  };
}
