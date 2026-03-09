import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listDeals,
  getPipelineStages,
  calculatePipelineMetrics,
} from "@/lib/hubspot";
import { syncFXRates } from "@/lib/sync/sync-fx";

/**
 * GET /api/cron/backfill-pipeline?from=YYYY-MM&to=YYYY-MM
 *
 * Backfills pipeline_snapshots (and fx_rates) for a range of historical months.
 *
 * Fetches all deals from HubSpot ONCE, then computes metrics for each month
 * locally — fast and avoids rate limits.
 *
 * Auth: CRON_SECRET or localhost.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Default: from earliest deal createdate to current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Fetch all deals and stages once
    console.log(`[backfill] Fetching all deals and stages from HubSpot...`);
    const [deals, stages] = await Promise.all([
      listDeals(),
      getPipelineStages(),
    ]);
    console.log(`[backfill] Fetched ${deals.length} deals, ${stages.length} stages`);

    // Determine date range from deal data if not specified
    const from = fromParam ?? getEarliestDealMonth(deals);
    const to = toParam ?? currentMonth;

    if (!from) {
      return NextResponse.json(
        { error: "No deals found — nothing to backfill" },
        { status: 400 }
      );
    }

    const months = generateMonthRange(from, to);
    console.log(`[backfill] Backfilling ${months.length} months: ${months[0]} → ${months[months.length - 1]}`);

    const supabase = createAdminClient();
    const stageMap = new Map(stages.map((s) => [s.stageId, s.label]));
    const results: { month: string; status: string; dealsWon?: number; dealsOpen?: number; dealsLost?: number }[] = [];

    for (const month of months) {
      try {
        // Compute pipeline metrics for this month
        const metrics = calculatePipelineMetrics(deals, stages, month);

        const dealsJson = metrics.deals.map((d) => ({
          id: d.id,
          name: d.properties.dealname,
          amount: d.properties.amount,
          stage: d.properties.dealstage,
          stage_label: stageMap.get(d.properties.dealstage) ?? d.properties.dealstage,
          closedate: d.properties.closedate,
          days_to_close: d.properties.days_to_close,
        }));

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

        if (error) throw error;

        // Also sync FX rates for this month
        await syncFXRates(month);

        console.log(
          `[backfill] ${month}: won=${metrics.dealsWon} lost=${metrics.dealsLost} open=${metrics.dealsOpen}`
        );
        results.push({
          month,
          status: "ok",
          dealsWon: metrics.dealsWon,
          dealsOpen: metrics.dealsOpen,
          dealsLost: metrics.dealsLost,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backfill] ${month} FAILED: ${msg}`);
        results.push({ month, status: `error: ${msg}` });
      }
    }

    return NextResponse.json({
      message: `Backfilled ${results.length} months`,
      from,
      to,
      totalDeals: deals.length,
      results,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[backfill] Fatal error:", msg);
    return NextResponse.json(
      { error: "Backfill failed", detail: msg },
      { status: 500 }
    );
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function getEarliestDealMonth(deals: { properties: { createdate: string } }[]): string | null {
  let earliest: string | null = null;
  for (const d of deals) {
    const cd = d.properties.createdate?.slice(0, 7); // YYYY-MM
    if (cd && (!earliest || cd < earliest)) earliest = cd;
  }
  return earliest;
}

function generateMonthRange(from: string, to: string): string[] {
  const months: string[] = [];
  const [fromY, fromM] = from.split("-").map(Number);
  const [toY, toM] = to.split("-").map(Number);

  let y = fromY;
  let m = fromM;

  while (y < toY || (y === toY && m <= toM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}
