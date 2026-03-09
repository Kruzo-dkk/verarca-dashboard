import { syncFXRates } from "./sync-fx";
import { syncPipeline } from "./sync-pipeline";
import { syncCustomers } from "./sync-customers";
import { syncCustomerSnapshots } from "./sync-customer-snapshots";
import { syncDiscounts } from "./sync-discounts";
import { syncMonthlySnapshot } from "./sync-frisbii";

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
    console.log(`[sync-monthly] ${name} completed in ${durationMs}ms`);
    return { module: name, status: "success", durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sync-monthly] ${name} FAILED after ${durationMs}ms:`, message);
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

  console.log(`[sync-monthly] ========================================`);
  console.log(`[sync-monthly] Starting full monthly sync for ${month}`);
  console.log(`[sync-monthly] ========================================`);

  const results: ModuleResult[] = [];

  // ── Step 1 & 2: FX rates and Pipeline (independent, run in parallel) ──
  const [fxResult, pipelineResult] = await Promise.all([
    runModule("sync-fx", () => syncFXRates(month)),
    runModule("sync-pipeline", () => syncPipeline(month)),
  ]);
  results.push(fxResult, pipelineResult);

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

  // ── Summary ────────────────────────────────────────────────
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

  console.log(`[sync-monthly] ========================================`);
  console.log(
    `[sync-monthly] Sync ${success ? "COMPLETED" : "COMPLETED WITH ERRORS"} in ${totalDurationMs}ms`
  );
  if (failedModules.length > 0) {
    console.log(
      `[sync-monthly] Failed modules: ${failedModules.map((r) => r.module).join(", ")}`
    );
  }
  console.log(`[sync-monthly] ========================================`);

  return summary;
}
