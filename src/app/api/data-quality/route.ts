import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSubscriptions } from "@/lib/frisbii";
import { hubspotFetch } from "@/lib/hubspot";
import type {
  DataQualityData,
  DataQualityError,
  ReconciliationStatus,
  AnomalyItem,
  ExclusionItem,
  OverrideCounts,
  FrisbiiComparison,
  SyncRunLog,
} from "@/lib/types/data-quality";
import type {
  HubSpotSyncHealth,
  HubSpotMatchRate,
  HubSpotApiStatus,
} from "@/lib/sync/types";
import { collapsedCustomerMRR } from "@/lib/sync/reconcile";

// ── HubSpot API status cache (60-second in-memory) ───────────────────────────
// Avoids probing HubSpot on every dashboard request.
let cachedApiStatus: { value: HubSpotApiStatus; expiresAt: number } | null = null;

/** Exported for testing only — clears the module-level cache. */
export function __resetHubSpotApiStatusCache(): void {
  cachedApiStatus = null;
}

// ── DB module name → response module name mapping ────────────────────────────
const MODULE_MAP: Record<string, HubSpotSyncHealth["module"]> = {
  "sync-pipeline": "pipeline",
  "sync-activities": "activities",
  "sync-tickets": "tickets",
  "sync-customers": "customers",
};

const HUBSPOT_MODULES = ["sync-pipeline", "sync-activities", "sync-tickets", "sync-customers"] as const;

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
    { data: auditLogs },
    { count: scopeOverrideCount },
    { count: tierOverrideCount },
    { data: activeSnapRows },
    { data: confirmedLinkRows },
    { data: linkCustomerRows },
  ] = await Promise.all([
    admin
      .from("monthly_snapshots")
      .select("mrr")
      .eq("month", month)
      .maybeSingle(),
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
      .select("customer_id")
      .eq("month", month)
      .eq("status", "active"),
    admin
      .from("customer_links")
      .select("canonical_handle, linked_handle")
      .eq("status", "confirmed"),
    admin.from("customers").select("id, frisbii_handle"),
  ]);

  // Resolve a handle to its canonical so linked customers count once on BOTH
  // sides of the reconciliation (matches the deduped dashboard count).
  const confirmedLinks = new Map(
    (confirmedLinkRows ?? []).map((l) => [l.linked_handle, l.canonical_handle])
  );
  const idToHandle = new Map(
    (linkCustomerRows ?? []).map((c) => [c.id, c.frisbii_handle])
  );
  const resolveCanonicalHandle = (handle: string): string => {
    let cur = handle;
    const seen = new Set<string>();
    while (confirmedLinks.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = confirmedLinks.get(cur)!;
    }
    return cur;
  };
  const supabaseActiveCount = new Set(
    (activeSnapRows ?? []).map((r) =>
      resolveCanonicalHandle(idToHandle.get(r.customer_id) ?? `id-${r.customer_id}`)
    )
  ).size;

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

  // ── Sync log (full record of what each module synced) ─────────
  const { data: syncRunRows } = await admin
    .from("sync_runs")
    .select(
      "id, module, month, status, started_at, finished_at, duration_ms, records_fetched, records_upserted, error_message"
    )
    .order("started_at", { ascending: false })
    .limit(150);
  const syncLog: SyncRunLog[] = (syncRunRows ?? []).map((r) => ({
    id: r.id,
    module: r.module,
    month: r.month,
    status: r.status,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    recordsFetched: r.records_fetched,
    recordsUpserted: r.records_upserted,
    errorMessage: r.error_message,
  }));

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
    // Collapsed (de-duped) customer sum — the SAME source as the validate-sync
    // audit check, so the card and the check cannot disagree.
    const sumCustomerMRR = await collapsedCustomerMRR(month);
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
    // Count unique real-world customers: collapse multiple subs per handle AND
    // linked handles (same dedup as Supabase) so both sides are comparable.
    const uniqueCustomers = new Set(
      activeSubs.map((s) => resolveCanonicalHandle(s.customer))
    );
    const frisbiiCount = uniqueCustomers.size;
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

  // ── HubSpot sync health (latest sync_runs row per module) ─────
  const syncRunResults = await Promise.all(
    HUBSPOT_MODULES.map((moduleName) =>
      admin
        .from("sync_runs")
        .select(
          "module, status, started_at, finished_at, duration_ms, records_fetched, records_upserted, error_message, metadata"
        )
        .eq("module", moduleName)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );

  const hubspotSyncHealth: HubSpotSyncHealth[] = syncRunResults
    .map((result) => result.data)
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row) => ({
      module: MODULE_MAP[row.module as string],
      status: row.status as HubSpotSyncHealth["status"],
      startedAt: row.started_at as string,
      durationMs: row.duration_ms as number | null,
      recordsFetched: row.records_fetched as number | null,
      recordsUpserted: row.records_upserted as number | null,
      errorMessage: row.error_message as string | null,
      metadata: row.metadata as Record<string, unknown> | null,
    }));

  // ── HubSpot match rate (from sync-customers metadata) ─────────
  // The latest sync-customers run may have FAILED (metadata null) — don't let
  // that make the whole Kundematch section disappear. Prefer the latest run's
  // metadata, but fall back to the last SUCCESSFUL run that carries it.
  let hubspotMatchRate: HubSpotMatchRate | null = null;
  const latestCustomers = syncRunResults
    .map((r) => r.data)
    .find((d) => d?.module === "sync-customers");
  let matchMeta: Record<string, unknown> | null =
    latestCustomers?.metadata != null
      ? (latestCustomers.metadata as Record<string, unknown>)
      : null;
  if (matchMeta == null) {
    const { data: lastGood } = await admin
      .from("sync_runs")
      .select("metadata")
      .eq("module", "sync-customers")
      .eq("status", "success")
      .not("metadata", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    matchMeta = (lastGood?.metadata as Record<string, unknown> | null) ?? null;
  }
  if (matchMeta != null) {
    const meta = matchMeta;
    if (typeof meta.matchedHubSpot === "number") {
      const matched = meta.matchedHubSpot;
      const unmatched = typeof meta.unmatchedHubSpot === "number" ? meta.unmatchedHubSpot : 0;
      const total = matched + unmatched;
      hubspotMatchRate = {
        total,
        matched,
        rate: total > 0 ? matched / total : 0,
        byConfidence: {
          high: typeof meta.clickupHigh === "number" ? meta.clickupHigh : 0,
          medium: typeof meta.clickupMedium === "number" ? meta.clickupMedium : 0,
          low: typeof meta.clickupLow === "number" ? meta.clickupLow : 0,
        },
      };
    }
  }

  // ── HubSpot API status probe (cached 60 seconds) ───────────────
  let hubspotApiStatus: HubSpotApiStatus;
  const now2 = Date.now();
  if (cachedApiStatus && cachedApiStatus.expiresAt > now2) {
    hubspotApiStatus = cachedApiStatus.value;
  } else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await hubspotFetch("/owners?limit=1");
      hubspotApiStatus = { ok: true, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "HubSpot probe failed";
      hubspotApiStatus = { ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
    cachedApiStatus = { value: hubspotApiStatus, expiresAt: now2 + 60_000 };
  }

  // ── Response ──────────────────────────────────────────────────
  const data: DataQualityData = {
    month,
    reconciliation,
    anomalies,
    exclusions: exclusionItems,
    overrideCounts,
    frisbiiComparison,
    syncLog,
    lastSyncAt,
    errors,
    hubspotSyncHealth,
    hubspotMatchRate,
    hubspotApiStatus,
  };

  return NextResponse.json(data);
}
