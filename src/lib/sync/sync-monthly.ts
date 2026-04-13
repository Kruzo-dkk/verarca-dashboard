import { syncFXRates } from "./sync-fx";
import { syncPipeline } from "./sync-pipeline";
import { syncCustomers } from "./sync-customers";
import { syncCustomerSnapshots } from "./sync-customer-snapshots";
import { syncDiscounts } from "./sync-discounts";
import { syncMonthlySnapshot } from "./sync-frisbii";
import { syncChannelMetrics } from "./sync-channel-metrics";
import { syncActivities } from "./sync-activities";
import { syncTickets } from "./sync-tickets";
import { validateSync } from "./validate-sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLog } from "./logger";

// ─── Types ─────────────────────────────────────────────────────

interface ModuleResult {
  module: string;
  status: "success" | "error";
  durationMs: number;
  error?: string;
}

export interface MonthlySyncSummary {
  month: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  results: ModuleResult[];
  success: boolean;
}

// ─── Runner helper ─────────────────────────────────────────────

async function runModule(
  name: string,
  fn: () => Promise<void>
): Promise<ModuleResult> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    syncLog.info(`[sync-monthly] ${name} completed in ${durationMs}ms`);
    return { module: name, status: "success", durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    syncLog.error(`[sync-monthly] ${name} FAILED after ${durationMs}ms:`, message);
    return { module: name, status: "error", durationMs, error: message };
  }
}

// ─── Orchestrator ──────────────────────────────────────────────

/**
 * Run all monthly data sync modules in the correct dependency order.
 *
 * Execution order:
 *   1. FX rates    -- no dependencies
 *   2. Pipeline    -- no dependencies (runs in parallel with FX)
 *   3. Customers   -- syncs current state, no month param
 *   4. Customer snapshots -- depends on customers existing in DB
 *   5. Discount snapshots -- depends on customers for ID mapping
 *   6. Monthly snapshot   -- depends on customer snapshots for MRR decomposition
 *   7. Channel metrics   -- depends on customers + customer snapshots
 *
 * Each module is wrapped in try/catch so that a failure in one module
 * does not prevent subsequent modules from running. The summary reports
 * all results and errors.
 *
 * @param month - YYYY-MM format (e.g. "2025-05")
 * @returns Summary object with per-module results
 */
export async function runMonthlySyncAll(
  month: string
): Promise<MonthlySyncSummary> {
  const startedAt = new Date().toISOString();
  const overallStart = Date.now();

  // ── Idempotency guard: skip if last successful run was <10 min ago ──
  const supabase = createAdminClient();
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recentRun } = await supabase
    .from("sync_audit_log")
    .select("sync_run_at")
    .eq("month", month)
    .eq("status", "pass")
    .gt("sync_run_at", tenMinAgo)
    .limit(1);

  if (recentRun && recentRun.length > 0) {
    syncLog.info(
      `[sync-monthly] Skipping — last successful sync was at ${recentRun[0].sync_run_at} (<10 min ago)`
    );
    return {
      month,
      startedAt,
      completedAt: startedAt,
      totalDurationMs: 0,
      results: [],
      success: true,
    };
  }

  syncLog.info(`[sync-monthly] ========================================`);
  syncLog.info(`[sync-monthly] Starting full monthly sync for ${month}`);
  syncLog.info(`[sync-monthly] ========================================`);

  const results: ModuleResult[] = [];

  // ── Step 1: Independent syncs (FX, Pipeline, Activities, Tickets) ──
  const [fxResult, pipelineResult, activitiesResult, ticketsResult] = await Promise.all([
    runModule("sync-fx", () => syncFXRates(month)),
    runModule("sync-pipeline", () => syncPipeline(month)),
    runModule("sync-activities", () => syncActivities(month)),
    runModule("sync-tickets", () => syncTickets(month)),
  ]);
  results.push(fxResult, pipelineResult, activitiesResult, ticketsResult);

  // ── Step 3: Customers (current state sync, no month param) ──
  const customersResult = await runModule("sync-customers", () =>
    syncCustomers()
  );
  results.push(customersResult);

  // ── Step 4: Customer snapshots (depends on customers) ──
  const customerSnapshotsResult = await runModule(
    "sync-customer-snapshots",
    () => syncCustomerSnapshots(month)
  );
  results.push(customerSnapshotsResult);

  // ── Step 5: Discount snapshots (depends on customers) ──
  const discountsResult = await runModule("sync-discounts", () =>
    syncDiscounts(month)
  );
  results.push(discountsResult);

  // ── Step 6: Monthly snapshot (depends on customer snapshots) ──
  const monthlyResult = await runModule("sync-monthly-snapshot", () =>
    syncMonthlySnapshot(month)
  );
  results.push(monthlyResult);

  // ── Step 7: Channel metrics (depends on customers + customer snapshots) ──
  const channelResult = await runModule("sync-channel-metrics", () =>
    syncChannelMetrics(month)
  );
  results.push(channelResult);

  // ── Step 8: Post-sync validation (non-blocking) ──
  const validationResult = await runModule("validate-sync", () =>
    validateSync(month)
  );
  results.push(validationResult);

  // ── Summary ���────────────────────────────────��──────────────
  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - overallStart;
  const success = results.every((r) => r.status === "success");

  const summary: MonthlySyncSummary = {
    month,
    startedAt,
    completedAt,
    totalDurationMs,
    results,
    success,
  };

  const failedModules = results.filter((r) => r.status === "error");

  syncLog.info(`[sync-monthly] ========================================`);
  syncLog.info(
    `[sync-monthly] Sync ${success ? "COMPLETED" : "COMPLETED WITH ERRORS"} in ${totalDurationMs}ms`
  );
  if (failedModules.length > 0) {
    syncLog.info(
      `[sync-monthly] Failed modules: ${failedModules.map((r) => r.module).join(", ")}`
    );
  }
  syncLog.info(`[sync-monthly] ========================================`);

  return summary;
}
