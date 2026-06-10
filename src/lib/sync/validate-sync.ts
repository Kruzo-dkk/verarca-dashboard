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
 * Verify monthly_snapshots.mrr matches the sum of customer_snapshots.mrr
 * for active customers. Since both are derived from the same source
 * (customer_snapshots), a divergence indicates a sync pipeline bug.
 *
 * Thresholds are tight because rounding is the only expected source of delta:
 *   - warn: delta > 100 øre (>1 DKK — possible rounding accumulation)
 *   - fail: delta > 1000 øre (>10 DKK — likely a bug)
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
  if (delta > 1000) status = "fail"; // >10 DKK — likely a bug
  else if (delta > 100) status = "warn"; // >1 DKK — rounding accumulation

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
      const endDate = (s.expired_date || s.cancelled_date)?.slice(0, 10);
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

/**
 * Verify that the sync-pipeline module ran recently and successfully.
 * A missing or stale run indicates the HubSpot pipeline sync is broken.
 */
async function checkHubSpotPipelineHealth(): Promise<ValidationCheck> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("module", "sync-pipeline")
    .order("started_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] ?? null;

  if (!row) {
    return {
      checkName: "hubspot_pipeline_health",
      status: "fail",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "Pipeline sync did not run in last 24h",
    };
  }

  const startedAt = new Date(row.started_at);
  const ageMs = Date.now() - startedAt.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  if (ageMs > twentyFourHoursMs) {
    return {
      checkName: "hubspot_pipeline_health",
      status: "fail",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "Pipeline sync did not run in last 24h",
    };
  }

  if (row.status === "failed") {
    return {
      checkName: "hubspot_pipeline_health",
      status: "fail",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: `Pipeline sync last failed: ${row.error_message ?? "unknown error"}`,
    };
  }

  if (row.status === "running") {
    const tenMinutesMs = 10 * 60 * 1000;
    if (ageMs > tenMinutesMs) {
      return {
        checkName: "hubspot_pipeline_health",
        status: "warn",
        expectedValue: null,
        actualValue: null,
        delta: null,
        details: "Pipeline sync stuck in running state for >10min",
      };
    }
  }

  if (row.status === "success" && (row.records_fetched ?? 0) === 0) {
    return {
      checkName: "hubspot_pipeline_health",
      status: "warn",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "Pipeline ran but fetched 0 deals",
    };
  }

  return {
    checkName: "hubspot_pipeline_health",
    status: "pass",
    expectedValue: null,
    actualValue: String(row.records_fetched),
    delta: null,
    details: null,
  };
}

/**
 * Check the HubSpot customer match rate from the latest successful sync-customers run.
 * A low match rate means Frisbii customers are not being linked to HubSpot contacts.
 *
 * Thresholds:
 *   - pass:  rate >= 0.7
 *   - warn:  rate >= 0.4  (fewer than 70% matched)
 *   - fail:  rate < 0.4   (fewer than 40% matched — data quality problem)
 */
async function checkHubSpotMatchRate(): Promise<ValidationCheck> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("module", "sync-customers")
    .eq("status", "success")
    .order("started_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] ?? null;

  if (!row) {
    return {
      checkName: "hubspot_match_rate",
      status: "fail",
      expectedValue: "0.7",
      actualValue: null,
      delta: null,
      details: "No successful customers sync found",
    };
  }

  const meta = row.metadata as Record<string, unknown> | null;
  const rawRate = meta?.matchRate;

  if (typeof rawRate !== "number") {
    return {
      checkName: "hubspot_match_rate",
      status: "fail",
      expectedValue: "0.7",
      actualValue: null,
      delta: null,
      details: "matchRate metadata missing",
    };
  }

  const rate = rawRate;
  const pct = `${Math.round(rate * 100)}%`;

  if (rate >= 0.7) {
    return {
      checkName: "hubspot_match_rate",
      status: "pass",
      expectedValue: "0.7",
      actualValue: rate.toFixed(2),
      delta: Math.round((rate - 0.7) * 100) / 100,
      details: null,
    };
  }

  if (rate >= 0.4) {
    return {
      checkName: "hubspot_match_rate",
      status: "warn",
      expectedValue: "0.7",
      actualValue: rate.toFixed(2),
      delta: Math.round((rate - 0.7) * 100) / 100,
      details: `Match rate <70%: only ${pct} of customers matched to HubSpot`,
    };
  }

  return {
    checkName: "hubspot_match_rate",
    status: "fail",
    expectedValue: "0.7",
    actualValue: rate.toFixed(2),
    delta: Math.round((rate - 0.7) * 100) / 100,
    details: `Match rate <40%: only ${pct} of customers matched`,
  };
}

// ─── Metric-integrity invariants ─────────────────────────────
// These assert that the headline figures reconcile with each other. A failure
// means a stored number contradicts its own components (the class of bug that
// let NRR read 106% with zero expansion).

function priorMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Pure invariant predicates (exported for unit tests).

/** Problems with the NRR/GRR/expansion relationship; empty array = consistent. */
export function nrrGrrProblems(
  nrr: number,
  grr: number,
  expansionMrr: number
): string[] {
  const problems: string[] = [];
  if (nrr < grr - 0.01) problems.push(`NRR ${nrr} < GRR ${grr} (impossible)`);
  if (nrr > grr + 0.01 && expansionMrr <= 0)
    problems.push(`NRR ${nrr} > GRR ${grr} but expansion_mrr=0`);
  if (Math.abs(nrr - grr) <= 0.01 && expansionMrr > 0)
    problems.push(`NRR == GRR but expansion_mrr=${expansionMrr} > 0`);
  return problems;
}

/** Expected MRR from the prior month + this month's waterfall. */
export function mrrWaterfallExpected(
  prevMrr: number,
  newMrr: number,
  expansionMrr: number,
  contractionMrr: number,
  churnedMrr: number
): number {
  return prevMrr + newMrr + expansionMrr - contractionMrr - churnedMrr;
}

/** Problems with the ARR=MRR×12 and ARPA=MRR/count identities. */
export function arrArpaProblems(
  mrr: number,
  arr: number,
  arpa: number,
  customerCount: number
): string[] {
  const problems: string[] = [];
  if (arr !== mrr * 12) problems.push(`arr ${arr} ≠ mrr×12 (${mrr * 12})`);
  if (customerCount > 0) {
    const expectedArpa = Math.round(mrr / customerCount);
    if (Math.abs(arpa - expectedArpa) > 1)
      problems.push(`arpa ${arpa} ≠ mrr/count (${expectedArpa})`);
  }
  return problems;
}

/**
 * NRR/GRR consistency: NRR ≥ GRR always, and NRR > GRR ⟺ expansion_mrr > 0.
 * Self-contained from the snapshot's own fields — would have caught the
 * "106% NRR with zero expansion" bug immediately.
 */
async function checkNrrGrrConsistency(month: string): Promise<ValidationCheck> {
  const supabase = createAdminClient();
  const { data: s } = await supabase
    .from("monthly_snapshots")
    .select("nrr, grr, expansion_mrr")
    .eq("month", month)
    .maybeSingle();
  if (!s || s.nrr == null || s.grr == null) {
    return {
      checkName: "nrr_grr_consistency",
      status: "pass",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: s ? "NRR/GRR not computed" : "No monthly snapshot yet",
    };
  }
  const nrr = Number(s.nrr);
  const grr = Number(s.grr);
  const exp = s.expansion_mrr ?? 0;
  const problems = nrrGrrProblems(nrr, grr, exp);
  return {
    checkName: "nrr_grr_consistency",
    status: problems.length ? "fail" : "pass",
    expectedValue: "nrr ≥ grr; nrr > grr ⟺ expansion > 0",
    actualValue: `nrr=${nrr}, grr=${grr}, expansion=${exp}`,
    delta: Math.round((nrr - grr) * 100) / 100,
    details: problems.length ? problems.join("; ") : null,
  };
}

/**
 * MRR waterfall closes: mrr[m] == mrr[m-1] + new + expansion − contraction − churned.
 */
async function checkMrrWaterfall(month: string): Promise<ValidationCheck> {
  const supabase = createAdminClient();
  const prev = priorMonth(month);
  const { data: rows } = await supabase
    .from("monthly_snapshots")
    .select("month, mrr, new_mrr, expansion_mrr, contraction_mrr, churned_mrr")
    .in("month", [month, prev]);
  const cur = (rows ?? []).find((r) => r.month === month);
  const pre = (rows ?? []).find((r) => r.month === prev);
  if (!cur || !pre) {
    return {
      checkName: "mrr_waterfall_identity",
      status: "pass",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "No prior month to compare",
    };
  }
  const expected = mrrWaterfallExpected(
    pre.mrr,
    cur.new_mrr ?? 0,
    cur.expansion_mrr ?? 0,
    cur.contraction_mrr ?? 0,
    cur.churned_mrr ?? 0
  );
  const delta = Math.abs(cur.mrr - expected);
  let status: "pass" | "warn" | "fail" = "pass";
  if (delta > 1000) status = "fail";
  else if (delta > 100) status = "warn";
  return {
    checkName: "mrr_waterfall_identity",
    status,
    expectedValue: String(expected),
    actualValue: String(cur.mrr),
    delta,
    details:
      status !== "pass"
        ? `MRR ${cur.mrr} ≠ prev ${pre.mrr} + new ${cur.new_mrr ?? 0} + exp ${cur.expansion_mrr ?? 0} − contr ${cur.contraction_mrr ?? 0} − churn ${cur.churned_mrr ?? 0} = ${expected} (Δ${delta} øre)`
        : null,
  };
}

/**
 * ARR == MRR × 12 (exact) and ARPA == round(MRR / customer_count) (±1 rounding).
 */
async function checkArrArpaIdentity(month: string): Promise<ValidationCheck> {
  const supabase = createAdminClient();
  const { data: s } = await supabase
    .from("monthly_snapshots")
    .select("mrr, arr, arpa, customer_count")
    .eq("month", month)
    .maybeSingle();
  if (!s) {
    return {
      checkName: "arr_arpa_identity",
      status: "pass",
      expectedValue: null,
      actualValue: null,
      delta: null,
      details: "No monthly snapshot yet",
    };
  }
  const problems = arrArpaProblems(s.mrr, s.arr, s.arpa ?? 0, s.customer_count);
  return {
    checkName: "arr_arpa_identity",
    status: problems.length ? "fail" : "pass",
    expectedValue: "arr=mrr×12; arpa=mrr/count",
    actualValue: `arr=${s.arr}, arpa=${s.arpa}`,
    delta: null,
    details: problems.length ? problems.join("; ") : null,
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
    checkHubSpotPipelineHealth(),
    checkHubSpotMatchRate(),
    // Metric-integrity invariants — assert the headline figures reconcile.
    checkNrrGrrConsistency(month),
    checkMrrWaterfall(month),
    checkArrArpaIdentity(month),
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
