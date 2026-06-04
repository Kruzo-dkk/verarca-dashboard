import { listDeals, getPipelineStages, calculatePipelineMetrics, buildStoredDeals } from "@/lib/hubspot";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncModuleResult } from "@/lib/sync/types";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Sync HubSpot pipeline data for a given month into `pipeline_snapshots`.
 *
 * Fetches all deals and pipeline stages, calculates metrics scoped to the
 * target month, and upserts the result.
 *
 * @param month - YYYY-MM format
 */
export async function syncPipeline(month: string): Promise<SyncModuleResult> {
  console.log(`[sync-pipeline] Starting pipeline sync for ${month}`);

  const [deals, stages] = await Promise.all([listDeals(), getPipelineStages()]);
  console.log(
    `[sync-pipeline] Fetched ${deals.length} deals, ${stages.length} stages`
  );

  const metrics = calculatePipelineMetrics(deals, stages, month);
  console.log(
    `[sync-pipeline] Metrics: won=${metrics.dealsWon}, lost=${metrics.dealsLost}, open=${metrics.dealsOpen}, winRate=${metrics.winRate}%`
  );

  // Build a JSON-serializable deals array for storage (shared shape — the
  // Sales dashboard reads exactly this).
  const stageMap = new Map(stages.map(s => [s.stageId, s.label]));
  const dealsJson = buildStoredDeals(metrics.deals, stageMap);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("pipeline_snapshots")
    .upsert(
      {
        month,
        total_pipeline_value: metrics.totalPipelineValue,
        weighted_pipeline: metrics.weightedPipeline,
        deals_won: metrics.dealsWon,
        deals_lost: metrics.dealsLost,
        deals_open: metrics.dealsOpen,
        avg_deal_size: metrics.avgDealSize,
        avg_sales_cycle_days: metrics.avgSalesCycleDays,
        win_rate: metrics.winRate,
        deals_json: dealsJson as unknown as Json,
      },
      { onConflict: "month" }
    );

  if (error) {
    console.error(`[sync-pipeline] Upsert failed:`, error);
    throw new Error(`[sync-pipeline] Upsert failed: ${error.message}`);
  }

  console.log(`[sync-pipeline] Successfully synced pipeline for ${month}`);

  // TODO: Phase 2 (Bølge 2) — extend getPipelineStages() to return total
  // pipeline count so pipelinesFound reflects multi-pipeline environments.
  return {
    recordsFetched: deals.length,
    recordsUpserted: 1,
    metadata: {
      pipelinesFound: stages.length > 0 ? 1 : 0,
      dealsWon: metrics.dealsWon,
      dealsLost: metrics.dealsLost,
      dealsOpen: metrics.dealsOpen,
      totalPipelineValue: metrics.totalPipelineValue,
      weightedPipeline: metrics.weightedPipeline,
      winRate: metrics.winRate,
    },
  };
}
