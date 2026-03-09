import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listDeals,
  getPipelineStages,
  calculatePipelineMetrics,
} from "@/lib/hubspot";
import { syncFXRates } from "@/lib/sync/sync-fx";
import { syncCustomers } from "@/lib/sync/sync-customers";
import { syncCustomerSnapshots } from "@/lib/sync/sync-customer-snapshots";
import { syncMonthlySnapshot } from "@/lib/sync/sync-frisbii";

/**
 * GET /api/cron/backfill-pipeline?from=YYYY-MM&to=YYYY-MM
 *
 * Backfills ALL monthly data for a range of historical months:
 *   - Pipeline snapshots (HubSpot deals — fetched once, computed per month)
 *   - FX rates (Frankfurter API)
 *   - Customer profiles (Frisbii + ClickUp — synced once)
 *   - Customer MRR snapshots (Frisbii subscriptions — per month)
 *   - Monthly aggregate snapshots (MRR decomposition — per month)
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

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── Step 1: Sync customers once (Frisbii + ClickUp) ────────
    console.log(`[backfill] Step 1: Syncing customer profiles...`);
    await syncCustomers();
    console.log(`[backfill] Customer profiles synced`);

    // ── Step 2: Fetch all HubSpot deals once ───────────────────
    console.log(`[backfill] Step 2: Fetching all deals and stages from HubSpot...`);
    const [deals, stages] = await Promise.all([
      listDeals(),
      getPipelineStages(),
    ]);
    console.log(`[backfill] Fetched ${deals.length} deals, ${stages.length} stages`);

    // Determine date range
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

    interface MonthResult {
      month: string;
      status: string;
      pipeline?: { won: number; lost: number; open: number };
      error?: string;
    }
    const results: MonthResult[] = [];

    // ── Step 3: Loop through each month ────────────────────────
    for (const month of months) {
      try {
        console.log(`[backfill] ── ${month} ──────────────────────`);

        // 3a. Pipeline snapshot (computed locally from pre-fetched deals)
        const metrics = calculatePipelineMetrics(deals, stages, month);
        const dealsJson = metrics.deals.map((d) => ({
          id: d.id,
          name: d.properties.dealname,
          amount: d.properties.amount_in_home_currency ?? d.properties.amount,
          stage: d.properties.dealstage,
          stage_label: stageMap.get(d.properties.dealstage) ?? d.properties.dealstage,
          closedate: d.properties.closedate,
          days_to_close: d.properties.days_to_close,
        }));

        const { error: pipelineErr } = await supabase
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
        if (pipelineErr) throw pipelineErr;
        console.log(`[backfill]   pipeline: won=${metrics.dealsWon} lost=${metrics.dealsLost} open=${metrics.dealsOpen}`);

        // 3b. FX rates
        await syncFXRates(month);

        // 3c. Customer MRR snapshots (uses historical subscription filtering)
        await syncCustomerSnapshots(month);

        // 3d. Monthly aggregate snapshot (MRR decomposition, retention, etc.)
        await syncMonthlySnapshot(month);

        results.push({
          month,
          status: "ok",
          pipeline: {
            won: metrics.dealsWon,
            lost: metrics.dealsLost,
            open: metrics.dealsOpen,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[backfill] ${month} FAILED: ${msg}`);
        results.push({ month, status: "error", error: msg });
      }
    }

    const failed = results.filter((r) => r.status === "error");

    return NextResponse.json({
      message: `Backfilled ${results.length} months (${failed.length} errors)`,
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
