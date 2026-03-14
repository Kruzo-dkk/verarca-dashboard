import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getReportData } from "@/lib/report-data";

/**
 * GET /api/report/board?month=YYYY-MM
 *
 * Returns a curated subset of ReportData suitable for board members.
 * Excludes: individual customer names, deal details, forecast assumptions,
 *           cohort-level data, and settings.
 *
 * Accessible by: management, board
 */
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["management", "board"]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const params = request.nextUrl.searchParams;
    const month = params.get("month") ?? getCurrentMonth();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    const full = await getReportData(month, month, "DKK");

    // Strip sensitive data — board sees aggregate metrics only
    const boardData = {
      month: full.month,
      currency: full.currency,
      fxRates: full.fxRates,

      revenue: {
        mrr: full.revenue.mrr,
        arr: full.revenue.arr,
        netNewMRR: full.revenue.netNewMRR,
        decomposition: full.revenue.decomposition,
        nonRecurringRevenue: full.revenue.nonRecurringRevenue,
        mrrHistory: full.revenue.mrrHistory,
        arrHistory: full.revenue.arrHistory,
        growthMoM: full.revenue.growthMoM,
        growthYoY: full.revenue.growthYoY,
        // Omit committedMRR (subscription-level detail)
      },

      retention: {
        nrr: full.retention.nrr,
        grr: full.retention.grr,
        logoRetentionRate: full.retention.logoRetentionRate,
        quickRatio: full.retention.quickRatio,
        nrrHistory: full.retention.nrrHistory,
        // Omit cohortData (customer-level detail)
      },

      customers: {
        count: full.customers.count,
        newLogos: full.customers.newLogos,
        churnedLogos: full.customers.churnedLogos,
        arpa: full.customers.arpa,
        top10Concentration: full.customers.top10Concentration,
        // Omit: segments, topCustomers, recentlyChurned, countHistory, arpaHistory
      },

      pipeline: {
        totalPipelineValue: full.pipeline.totalPipelineValue,
        weightedPipeline: full.pipeline.weightedPipeline,
        pipelineCoverage: full.pipeline.pipelineCoverage,
        dealsWon: full.pipeline.dealsWon,
        dealsLost: full.pipeline.dealsLost,
        dealsOpen: full.pipeline.dealsOpen,
        winRate: full.pipeline.winRate,
        avgSalesCycleDays: full.pipeline.avgSalesCycleDays,
        avgDealSize: full.pipeline.avgDealSize,
        // Omit: deals array (individual deal names/amounts)
      },

      commentary: full.commentary,
    };

    return NextResponse.json(boardData);
  } catch (error) {
    console.error("Failed to fetch board report:", error);
    return NextResponse.json(
      { error: "Failed to fetch board report" },
      { status: 500 }
    );
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
