import { createAdminClient } from "@/lib/supabase/admin";
import { listSubscriptions, type Subscription } from "@/lib/frisbii";
import { syncLog } from "./logger";

// ─── Types ────────────────────────────────────────────────────

interface ValidationCheck {
  checkName: string;
  status: "pass" | "warn" | "fail";
  expectedValue: string | null;
  actualValue: string | null;
  delta: number | null;
  details: string | null;
}

// ─── Individual checks ───────────────────────────────────────

/**
 * Compare monthly_snapshots.mrr with the sum of customer_snapshots.mrr
 * for active customers. They should match; divergence means the two
 * code paths computed different subscription sets.
 */
async function checkMRRReconciliation(
  month: string
): Promise<ValidationCheck> {
  const supabase = createAdminClient();

  const [{ data: snapshot }, { data: customerSnaps }] = await Promise.all([
    supabase
      .from("monthly_snapshots")
      .select("mrr")
      .eq("month", month)
      .maybeSingle(),
    supabase
      .from("customer_snapshots")
      .select("mrr")
      .eq("month", month)
      .eq("status", "active"),
  ]);

  if (!snapshot) {
    return {
      checkName: "mrr_reconciliation",
      status: "pass",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "No monthly snapshot yet",
    };
  }

  const snapshotMRR = snapshot.mrr;
  const sumCustomerMRR = (customerSnaps ?? []).reduce(
    (sum, r) => sum + (r.mrr ?? 0),
    0
  );
  const delta = Math.abs(snapshotMRR - sumCustomerMRR);

  let status: "pass" | "warn" | "fail" = "pass";
  if (delta > 10000) status = "fail"; // >100 DKK
  else if (delta > 100) status = "warn"; // >1 DKK

  return {
    checkName: "mrr_reconciliation",
    status,
    expectedValue: String(snapshotMRR),
    actualValue: String(Math.round(sumCustomerMRR)),
    delta,
    details:
      status !== "pass"
        ? `Snapshot MRR (${snapshotMRR}) differs from customer sum (${Math.round(sumCustomerMRR)}) by ${delta} øre`
        : null,
  };
}

/**
 * Check if churned_logos for the current month is suspiciously high
 * compared to the trailing 3-month average.
 */
async function checkChurnSpike(month: string): Promise<ValidationCheck> {
  const supabase = createAdminClient();

  // Get trailing 4 months (current + 3 prior) of churned_logos
  const [y, m] = month.split("-").map(Number);
  const months: string[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const { data: rows } = await supabase
    .from("monthly_snapshots")
    .select("month, churned_logos")
    .in("month", months);

  if (!rows || rows.length < 2) {
    return {
      checkName: "churn_spike",
      status: "pass",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "Not enough history for spike detection",
    };
  }

  const byMonth = new Map(rows.map((r) => [r.month, r.churned_logos ?? 0]));
  const currentChurn = byMonth.get(month) ?? 0;

  // Trailing 3-month average (excluding current month)
  const priorMonths = months.slice(0, 3);
  const priorValues = priorMonths
    .map((m) => byMonth.get(m))
    .filter((v): v is number => v !== undefined);

  if (priorValues.length === 0) {
    return {
      checkName: "churn_spike",
      status: "pass",
      expectedValue: null,
      actualValue: String(currentChurn),
      delta: null,
      details: "No prior churn data",
    };
  }

  const avg = priorValues.reduce((a, b) => a + b, 0) / priorValues.length;

  let status: "pass" | "warn" | "fail" = "pass";
  if (avg > 0 && currentChurn > avg * 2) {
    status = "warn";
  }

  return {
    checkName: "churn_spike",
    status,
    expectedValue: String(Math.round(avg * 100) / 100),
    actualValue: String(currentChurn),
    delta: avg > 0 ? Math.round((currentChurn / avg) * 100) / 100 : null,
    details:
      status === "warn"
        ? `Churned logos (${currentChurn}) is ${Math.round((currentChurn / avg) * 100) / 100}x the trailing 3-month average (${Math.round(avg * 100) / 100})`
        : null,
  };
}

/**
 * Detect customers who have both an expired/cancelled subscription
 * (within last 90 days) AND a currently active subscription. This pattern
 * indicates a delete/recreate that inflates churn numbers.
 */
async function checkDeleteRecreate(): Promise<ValidationCheck> {
  const allSubs = await listSubscriptions();

  // Group by customer handle
  const byCustomer = new Map<string, Subscription[]>();
  for (const sub of allSubs) {
    const existing = byCustomer.get(sub.customer) ?? [];
    existing.push(sub);
    byCustomer.set(sub.customer, existing);
  }

  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const flagged: { customer: string; activeSub: string; endedSub: string }[] =
    [];

  for (const [customer, subs] of byCustomer) {
    const hasActive = subs.some((s) => s.state === "active");
    if (!hasActive) continue;

    const recentlyEnded = subs.filter((s) => {
      if (s.state === "active") return false;
      const endDate = (s.expired || s.cancelled)?.slice(0, 10);
      return endDate && endDate >= ninetyDaysAgo;
    });

    if (recentlyEnded.length > 0) {
      const activeSub = subs.find((s) => s.state === "active")!;
      flagged.push({
        customer,
        activeSub: activeSub.handle,
        endedSub: recentlyEnded[0].handle,
      });
    }
  }

  return {
    checkName: "delete_recreate",
    status: flagged.length > 0 ? "warn" : "pass",
    expectedValue: "0",
    actualValue: String(flagged.length),
    delta: flagged.length,
    details:
      flagged.length > 0 ? JSON.stringify(flagged.slice(0, 20)) : null,
  };
}

// ─── Main validation ─────────────────────────────────────────

/**
 * Run all post-sync validation checks and store results in sync_audit_log.
 */
export async function validateSync(month: string): Promise<void> {
  syncLog.info(`[validate-sync] Running validation for ${month}`);

  const checks = await Promise.all([
    checkMRRReconciliation(month),
    checkChurnSpike(month),
    checkDeleteRecreate(),
  ]);

  const warnings = checks.filter((c) => c.status === "warn");
  const failures = checks.filter((c) => c.status === "fail");

  for (const check of checks) {
    const icon =
      check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    syncLog.info(
      `[validate-sync] ${icon} ${check.checkName}: ${check.status}${check.details ? ` — ${check.details}` : ""}`
    );
  }

  if (warnings.length > 0) {
    syncLog.warn(
      `[validate-sync] ${warnings.length} warning(s) detected`
    );
  }
  if (failures.length > 0) {
    syncLog.error(
      `[validate-sync] ${failures.length} failure(s) detected`
    );
  }

  // Persist to audit log
  const supabase = createAdminClient();
  const syncRunAt = new Date().toISOString();

  const rows = checks.map((c) => ({
    month,
    sync_run_at: syncRunAt,
    check_name: c.checkName,
    status: c.status,
    expected_value: c.expectedValue,
    actual_value: c.actualValue,
    delta: c.delta,
    details: c.details,
  }));

  const { error } = await supabase.from("sync_audit_log").insert(rows);

  if (error) {
    syncLog.error("[validate-sync] Failed to write audit log:", error.message);
    // Don't throw — validation logging failure shouldn't break the sync
  }

  syncLog.info(
    `[validate-sync] Validation complete: ${checks.length} checks, ${warnings.length} warnings, ${failures.length} failures`
  );
}
