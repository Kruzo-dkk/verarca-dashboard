import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  projectScenario,
  type ForecastAssumptions,
  type ForecastResult,
} from "@/lib/forecast";

/**
 * GET /api/forecast?horizon=12&month=YYYY-MM
 *
 * Returns forecast projections for all scenarios plus historical MRR data.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const horizon = parseInt(
      request.nextUrl.searchParams.get("horizon") ?? "12",
      10
    );
    const monthParam = request.nextUrl.searchParams.get("month");

    // Determine the starting month (latest with data, or specified)
    let startMonth: string;
    if (monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      startMonth = monthParam;
    } else {
      // Use the latest monthly snapshot
      const { data: latest } = await supabase
        .from("monthly_snapshots")
        .select("month")
        .order("month", { ascending: false })
        .limit(1)
        .single();
      startMonth = latest?.month ?? getCurrentMonth();
    }

    // Fetch in parallel: assumptions, current snapshot, historical data, pipeline
    const trailingStart = addMonthsUtil(startMonth, -11);

    const [assumptionsRes, snapshotRes, historicalRes, pipelineRes] =
      await Promise.all([
        supabase
          .from("forecast_assumptions")
          .select("*")
          .order("scenario"),

        supabase
          .from("monthly_snapshots")
          .select("mrr, arpa, customer_count")
          .eq("month", startMonth)
          .maybeSingle(),

        supabase
          .from("monthly_snapshots")
          .select("month, mrr, arr")
          .gte("month", trailingStart)
          .lte("month", startMonth)
          .order("month", { ascending: true }),

        supabase
          .from("pipeline_snapshots")
          .select("deals_json")
          .eq("month", startMonth)
          .maybeSingle(),
      ]);

    const assumptions = (assumptionsRes.data ?? []).map(
      (row): ForecastAssumptions => ({
        scenario: row.scenario,
        monthlyChurnPct: Number(row.monthly_churn_pct),
        monthlyExpansionPct: Number(row.monthly_expansion_pct),
        newLogosPerMonth: row.new_logos_per_month,
        avgNewDealSize: Number(row.avg_new_deal_size),
        pipelineConversionPct: Number(row.pipeline_conversion_pct),
      })
    );

    // If no assumptions exist, use defaults
    if (assumptions.length === 0) {
      assumptions.push(
        { scenario: "best", monthlyChurnPct: 1, monthlyExpansionPct: 3, newLogosPerMonth: 4, avgNewDealSize: 0, pipelineConversionPct: 30 },
        { scenario: "base", monthlyChurnPct: 2.5, monthlyExpansionPct: 1, newLogosPerMonth: 2, avgNewDealSize: 0, pipelineConversionPct: 20 },
        { scenario: "worst", monthlyChurnPct: 5, monthlyExpansionPct: 0, newLogosPerMonth: 0, avgNewDealSize: 0, pipelineConversionPct: 10 }
      );
    }

    const currentMRR = snapshotRes.data?.mrr ?? 0;
    const currentARPA = snapshotRes.data?.arpa ?? 0;

    // Fill in avg_new_deal_size if not set (default to ARPA)
    for (const a of assumptions) {
      if (a.avgNewDealSize === 0 && currentARPA > 0) {
        const multiplier =
          a.scenario === "best" ? 1.2 : a.scenario === "worst" ? 0.8 : 1.0;
        a.avgNewDealSize = Math.round(currentARPA * multiplier);
      }
    }

    // Parse pipeline deals
    const pipelineDeals = parsePipelineDeals(pipelineRes.data?.deals_json);

    // Project each scenario
    const projections = assumptions.map((a) => ({
      scenario: a.scenario,
      months: projectScenario(currentMRR, a, horizon, startMonth, pipelineDeals),
    }));

    const historical = (historicalRes.data ?? []).map((r) => ({
      month: r.month,
      mrr: r.mrr,
      arr: r.arr,
    }));

    const result: ForecastResult = {
      historical,
      projections,
      assumptions,
      currentMRR,
      currentARPA,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Forecast error:", error);
    return NextResponse.json(
      { error: "Failed to generate forecast" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/forecast
 *
 * Updates forecast assumptions for a scenario.
 * Body: { scenario, monthlyChurnPct, monthlyExpansionPct, newLogosPerMonth, avgNewDealSize, pipelineConversionPct }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scenario, ...rest } = body;

    if (!["best", "base", "worst"].includes(scenario)) {
      return NextResponse.json(
        { error: "Invalid scenario" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("forecast_assumptions")
      .upsert(
        {
          scenario,
          monthly_churn_pct: rest.monthlyChurnPct ?? 2.5,
          monthly_expansion_pct: rest.monthlyExpansionPct ?? 1.0,
          new_logos_per_month: rest.newLogosPerMonth ?? 2,
          avg_new_deal_size: rest.avgNewDealSize ?? 0,
          pipeline_conversion_pct: rest.pipelineConversionPct ?? 20,
        },
        { onConflict: "scenario" }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to save assumptions:", error);
      return NextResponse.json(
        { error: "Failed to save assumptions" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Forecast PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save assumptions" },
      { status: 500 }
    );
  }
}

// Helpers

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthsUtil(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parsePipelineDeals(dealsJson: unknown): { amount: number; probability: number; closeDate: string | null }[] {
  if (!dealsJson || !Array.isArray(dealsJson)) return [];
  return dealsJson.map((d: Record<string, unknown>) => ({
    amount: Math.round(Number(d.amount ?? 0) * 100), // whole DKK → øre
    probability: Number(d.probability ?? 0),
    closeDate: d.closedate != null ? String(d.closedate) : null,
  }));
}
