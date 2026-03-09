import { listDeals, getPipelineStages, calculatePipelineMetrics } from "@/lib/hubspot";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sync HubSpot pipeline data for a given month into `pipeline_snapshots`.
 *
 * Fetches all deals and pipeline stages, calculates metrics scoped to the
 * target month, and upserts the result.
 *
 * @param month - YYYY-MM format
 */
export async function syncPipeline(month: string): Promise<void> {
  console.log(`[sync-pipeline] Starting pipeline sync for ${month}`);

  const [deals, stages] = await Promise.all([listDeals(), getPipelineStages()]);
  console.log(
    `[sync-pipeline] Fetched ${deals.length} deals, ${stages.length} stages`
  );

  const metrics = calculatePipelineMetrics(deals, stages, month);
  console.log(
    `[sync-pipeline] Metrics: won=${metrics.dealsWon}, lost=${metrics.dealsLost}, open=${metrics.dealsOpen}, winRate=${metrics.winRate}%`
  );

  // Build a JSON-serializable deals array for storage
  const stageMap = new Map(stages.map(s => [s.stageId, s.label]));
  const dealsJson = metrics.deals.map((d) => ({
    id: d.id,
    name: d.properties.dealname,
    amount: d.properties.amount,
    stage: d.properties.dealstage,
    stage_label: stageMap.get(d.properties.dealstage) ?? d.properties.dealstage,
    closedate: d.properties.closedate,
    days_to_close: d.properties.days_to_close,
  }));

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
        deals_json: dealsJson,
      },
      { onConflict: "month" }
    );

  if (error) {
    console.error(`[sync-pipeline] Upsert failed:`, error);
    throw new Error(`[sync-pipeline] Upsert failed: ${error.message}`);
  }

  console.log(`[sync-pipeline] Successfully synced pipeline for ${month}`);
}
