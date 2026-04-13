import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSubscriptions } from "@/lib/frisbii";
import type {
  DataQualityData,
  DataQualityError,
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
    { count: scopeOverrideCount },
    { count: tierOverrideCount },
    { count: supabaseActiveCount },
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

  // Exclusions query wrapped in try-catch — table may not exist yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exclusions: any[] | null = null;
  try {
    const { data } = await admin
      .from("subscription_exclusions")
      .select("*")
      .order("created_at", { ascending: false });
    exclusions = data;
  } catch {
    exclusions = [];
  }

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
    if (delta > 1000) status = "fail";
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
    scopeOverrides: scopeOverrideCount ?? 0,
    tierOverrides: tierOverrideCount ?? 0,
  };

  // ── Frisbii comparison ────────────────────────────────────────
  let frisbiiComparison: FrisbiiComparison;
  let frisbiiError: string | null = null;
  try {
    const activeSubs = await listSubscriptions({ state: "active" });
    const frisbiiCount = activeSubs.length;
    const sbCount = supabaseActiveCount ?? 0;

    frisbiiComparison = {
      frisbiiActiveCount: frisbiiCount,
      supabaseActiveCount: sbCount,
      delta: frisbiiCount - sbCount,
      error: null,
    };
  } catch (err) {
    const sbCount = supabaseActiveCount ?? 0;
    frisbiiError = err instanceof Error ? err.message : "Frisbii API unavailable";
    frisbiiComparison = {
      frisbiiActiveCount: 0,
      supabaseActiveCount: sbCount,
      delta: 0,
      error: frisbiiError,
    };
  }

  // ── Last sync timestamp ───────────────────────────────────────
  const lastSyncAt = anomalies.length > 0 ? anomalies[0].syncRunAt : null;

  // ── Component-level errors ───────────────────────────────────
  const errors: DataQualityError[] = [];
  if (frisbiiError) errors.push({ component: "frisbii", message: frisbiiError });

  // ── Response ──────────────────────────────────────────────────
  const data: DataQualityData = {
    month,
    reconciliation,
    anomalies,
    exclusions: exclusionItems,
    overrideCounts,
    frisbiiComparison,
    lastSyncAt,
    errors,
  };

  return NextResponse.json(data);
}
