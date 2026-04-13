import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSubscriptions } from "@/lib/frisbii";
import type {
  DataQualityData,
  ReconciliationStatus,
  AnomalyItem,
  ExclusionItem,
  OverrideCounts,
  FrisbiiComparison,
} from "@/lib/types/data-quality";

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    searchParams.get("month") ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const admin = createAdminClient();

  // ── Fetch all data in parallel ────────────────────────────────
  const [
    { data: snapshot },
    { data: customerSnaps },
    { data: auditLogs },
    { data: exclusions },
    { data: scopeOverrides },
    { data: tierOverrides },
    { data: supabaseActiveCustomers },
  ] = await Promise.all([
    admin
      .from("monthly_snapshots")
      .select("mrr")
      .eq("month", month)
      .maybeSingle(),
    admin
      .from("customer_snapshots")
      .select("mrr")
      .eq("month", month)
      .eq("status", "active"),
    admin
      .from("sync_audit_log")
      .select("*")
      .eq("month", month)
      .order("sync_run_at", { ascending: false })
      .limit(20),
    admin
      .from("subscription_exclusions")
      .select("*")
      .order("created_at", { ascending: false }),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .not("scope_override", "is", null),
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .not("tier_override", "is", null),
    admin
      .from("customer_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("month", month)
      .eq("status", "active"),
  ]);

  // ── Reconciliation ────────────────────────────────────────────
  let reconciliation: ReconciliationStatus;
  if (!snapshot) {
    reconciliation = {
      status: "no_data",
      snapshotMRR: 0,
      sumCustomerMRR: 0,
      delta: 0,
    };
  } else {
    const snapshotMRR = snapshot.mrr;
    const sumCustomerMRR = (customerSnaps ?? []).reduce(
      (sum, r) => sum + (r.mrr ?? 0),
      0
    );
    const delta = Math.abs(snapshotMRR - sumCustomerMRR);
    let status: ReconciliationStatus["status"] = "pass";
    if (delta > 10000) status = "fail";
    else if (delta > 100) status = "warn";

    reconciliation = {
      status,
      snapshotMRR,
      sumCustomerMRR: Math.round(sumCustomerMRR),
      delta,
    };
  }

  // ── Anomalies (from audit log) ────────────────────────────────
  const anomalies: AnomalyItem[] = (auditLogs ?? []).map((log) => ({
    id: log.id,
    checkName: log.check_name,
    status: log.status,
    expectedValue: log.expected_value,
    actualValue: log.actual_value,
    delta: log.delta,
    details: log.details,
    syncRunAt: log.sync_run_at,
  }));

  // ── Exclusions with customer names ────────────────────────────
  const customerHandles = [
    ...new Set((exclusions ?? []).map((e) => e.customer_handle)),
  ];

  let customerNameMap = new Map<string, string>();
  if (customerHandles.length > 0) {
    const { data: customers } = await admin
      .from("customers")
      .select("frisbii_handle, name")
      .in("frisbii_handle", customerHandles);
    customerNameMap = new Map(
      (customers ?? []).map((c) => [c.frisbii_handle, c.name])
    );
  }

  const exclusionItems: ExclusionItem[] = (exclusions ?? []).map((e) => ({
    id: e.id,
    subscriptionHandle: e.subscription_handle,
    customerHandle: e.customer_handle,
    customerName: customerNameMap.get(e.customer_handle) ?? null,
    reason: e.reason,
    replacementHandle: e.replacement_subscription_handle,
    excludedBy: e.excluded_by,
    createdAt: e.created_at,
  }));

  // ── Override counts ───────────────────────────────────────────
  const overrideCounts: OverrideCounts = {
    scopeOverrides: (scopeOverrides as unknown as { count: number })?.count ?? 0,
    tierOverrides: (tierOverrides as unknown as { count: number })?.count ?? 0,
  };

  // ── Frisbii comparison ────────────────────────────────────────
  let frisbiiComparison: FrisbiiComparison;
  try {
    const activeSubs = await listSubscriptions({ state: "active" });
    const frisbiiCount = activeSubs.length;
    const supabaseCount =
      (supabaseActiveCustomers as unknown as { count: number })?.count ?? 0;

    frisbiiComparison = {
      frisbiiActiveCount: frisbiiCount,
      supabaseActiveCount: supabaseCount,
      delta: frisbiiCount - supabaseCount,
    };
  } catch {
    frisbiiComparison = {
      frisbiiActiveCount: 0,
      supabaseActiveCount: 0,
      delta: 0,
    };
  }

  // ── Response ──────────────────────────────────────────────────
  const data: DataQualityData = {
    month,
    reconciliation,
    anomalies,
    exclusions: exclusionItems,
    overrideCounts,
    frisbiiComparison,
  };

  return NextResponse.json(data);
}
