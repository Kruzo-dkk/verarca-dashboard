import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listDeals,
  getPipelineStages,
  calculatePipelineMetrics,
} from "@/lib/hubspot";
import type { PipelineDeal } from "@/lib/types/report";

/**
 * GET /api/pipeline?month=YYYY-MM
 *
 * For the current month: fetches live data from HubSpot.
 * For historical months: reads from the pipeline_snapshots table.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const monthParam = request.nextUrl.searchParams.get("month");
    const month = monthParam ?? getCurrentMonth();

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    // Current month: live HubSpot data
    if (isCurrentMonth(month)) {
      const [deals, stages] = await Promise.all([
        listDeals(),
        getPipelineStages(),
      ]);

      const metrics = calculatePipelineMetrics(deals, stages, month);

      // Map HubSpot deals to PipelineDeal format
      const pipelineDeals: PipelineDeal[] = metrics.deals.map((d) => ({
        id: d.id,
        name: d.properties.dealname,
        amount: Math.round(parseFloat(d.properties.amount || "0") * 100),
        stage: d.properties.dealstage,
        probability: parseFloat(
          d.properties.hs_deal_stage_probability || "0"
        ),
        closeDate: d.properties.closedate ?? null,
        daysToClose: d.properties.days_to_close
          ? parseInt(d.properties.days_to_close)
          : null,
        createDate: d.properties.createdate,
      }));

      return NextResponse.json({
        month,
        source: "live",
        totalPipelineValue: metrics.totalPipelineValue,
        weightedPipeline: metrics.weightedPipeline,
        dealsWon: metrics.dealsWon,
        dealsLost: metrics.dealsLost,
        dealsOpen: metrics.dealsOpen,
        winRate: metrics.winRate,
        avgSalesCycleDays: metrics.avgSalesCycleDays,
        avgDealSize: metrics.avgDealSize,
        deals: pipelineDeals,
      });
    }

    // Historical: read from pipeline_snapshots
    const { data, error } = await supabase
      .from("pipeline_snapshots")
      .select("*")
      .eq("month", month)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch pipeline snapshot:", error);
      return NextResponse.json(
        { error: "Failed to fetch pipeline data" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: `No pipeline snapshot found for month ${month}` },
        { status: 404 }
      );
    }

    // Parse deals_json
    const deals: PipelineDeal[] = Array.isArray(data.deals_json)
      ? (data.deals_json as Record<string, unknown>[]).map((d) => ({
          id: String(d.id ?? ""),
          name: String(d.name ?? ""),
          amount: Number(d.amount ?? 0),
          stage: String(d.stage ?? ""),
          probability: Number(d.probability ?? 0),
          closeDate: d.closeDate != null ? String(d.closeDate) : null,
          daysToClose: d.daysToClose != null ? Number(d.daysToClose) : null,
          createDate: String(d.createDate ?? ""),
        }))
      : [];

    return NextResponse.json({
      month,
      source: "snapshot",
      totalPipelineValue: data.total_pipeline_value,
      weightedPipeline: data.weighted_pipeline,
      dealsWon: data.deals_won,
      dealsLost: data.deals_lost,
      dealsOpen: data.deals_open,
      winRate: data.win_rate,
      avgSalesCycleDays: data.avg_sales_cycle_days,
      avgDealSize: data.avg_deal_size,
      deals,
    });
  } catch (error) {
    console.error("Failed to fetch pipeline data:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline data" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isCurrentMonth(month: string): boolean {
  return month === getCurrentMonth();
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
