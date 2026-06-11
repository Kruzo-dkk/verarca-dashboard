import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  projectScenario,
  computePredictedAssumptions,
  deriveSuggestedBand,
  type ForecastAssumptions,
  type ScenarioAssumptionMeta,
  type ForecastResult,
  type TrailingSnapshot,
} from "@/lib/forecast";
import {
  BAND_SCENARIOS,
  PREDICTED_WINDOW_OPTIONS,
  DEFAULT_PREDICTED_WINDOW,
} from "@/lib/forecast-scenarios";

/**
 * GET /api/forecast?horizon=12&month=YYYY-MM&window=6
 *
 * Returns forecast projections for all four scenarios plus historical MRR data.
 * "predicted" is derived live from trailing actuals; worst/better/best are the
 * stored custom rows when present, else suggested bands around predicted.
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

    // Trailing window length for the predicted derivation (3 / 6 / 12).
    const windowParam = parseInt(
      request.nextUrl.searchParams.get("window") ?? String(DEFAULT_PREDICTED_WINDOW),
      10
    );
    const predictedWindow = (PREDICTED_WINDOW_OPTIONS as readonly number[]).includes(
      windowParam
    )
      ? windowParam
      : DEFAULT_PREDICTED_WINDOW;

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

    // Fetch in parallel: custom assumptions, current snapshot, historical data,
    // trailing decomposition (for predicted), pipeline.
    const historicalStart = addMonthsUtil(startMonth, -11);
    // One extra predecessor month so the earliest in-window month has a prior MRR.
    const decompStart = addMonthsUtil(startMonth, -predictedWindow);

    const [assumptionsRes, snapshotRes, historicalRes, decompRes, pipelineRes] =
      await Promise.all([
        supabase.from("forecast_assumptions").select("*").order("scenario"),

        supabase
          .from("monthly_snapshots")
          .select("mrr, arpa, customer_count")
          .eq("month", startMonth)
          .maybeSingle(),

        supabase
          .from("monthly_snapshots")
          .select("month, mrr, arr")
          .gte("month", historicalStart)
          .lte("month", startMonth)
          .order("month", { ascending: true }),

        supabase
          .from("monthly_snapshots")
          .select(
            "month, mrr, churned_mrr, contraction_mrr, expansion_mrr, new_mrr, new_logos, new_paying_logos, arpa"
          )
          .gte("month", decompStart)
          .lte("month", startMonth)
          .order("month", { ascending: true }),

        supabase
          .from("pipeline_snapshots")
          .select("deals_json, win_rate")
          .eq("month", startMonth)
          .maybeSingle(),
      ]);

    const currentMRR = snapshotRes.data?.mrr ?? 0;
    const currentARPA = snapshotRes.data?.arpa ?? 0;

    // ── Predicted: derived live from trailing actuals + pipeline win-rate ──
    const trailing: TrailingSnapshot[] = (decompRes.data ?? []).map((r) => ({
      month: r.month,
      mrr: r.mrr ?? 0,
      churned_mrr: r.churned_mrr ?? 0,
      contraction_mrr: r.contraction_mrr ?? 0,
      expansion_mrr: r.expansion_mrr ?? 0,
      new_mrr: r.new_mrr ?? 0,
      new_logos: r.new_logos ?? 0,
      new_paying_logos: r.new_paying_logos,
      arpa: r.arpa ?? 0,
    }));
    const winRate = pipelineRes.data?.win_rate ?? null;
    const { assumptions: predicted, sufficientHistory } =
      computePredictedAssumptions(trailing, winRate);

    // ── Bands: stored custom row when present, else suggested from predicted ──
    const customByScenario = new Map<string, ForecastAssumptions>(
      (assumptionsRes.data ?? [])
        .filter((row) => (BAND_SCENARIOS as readonly string[]).includes(row.scenario))
        .map((row) => [row.scenario, rowToAssumptions(row)])
    );

    const bands: ScenarioAssumptionMeta[] = BAND_SCENARIOS.map((scenario) => {
      const custom = customByScenario.get(scenario);
      if (custom) {
        return { ...custom, isCustom: true, readOnly: false };
      }
      return { ...deriveSuggestedBand(predicted, scenario), isCustom: false, readOnly: false };
    });

    const assumptions: ScenarioAssumptionMeta[] = [
      { ...predicted, isCustom: false, readOnly: true },
      ...bands,
    ];

    // Parse pipeline deals (layered into bands only — predicted is run-rate only)
    const pipelineDeals = parsePipelineDeals(pipelineRes.data?.deals_json);

    // Project each scenario
    const projections = assumptions.map((a) => ({
      scenario: a.scenario,
      months: projectScenario(
        currentMRR,
        a,
        horizon,
        startMonth,
        a.scenario === "predicted" ? [] : pipelineDeals
      ),
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
      sufficientHistory,
      predictedWindow,
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
 * Saves a custom override for an editable band (worst | better | best).
 * "predicted" is read-only and rejected.
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

    if (!(BAND_SCENARIOS as readonly string[]).includes(scenario)) {
      return NextResponse.json({ error: "Invalid scenario" }, { status: 400 });
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

/**
 * DELETE /api/forecast?scenario=worst|better|best
 *
 * Removes a band's custom override, reverting it to the live suggested values.
 * Idempotent — deleting an absent row is a no-op success.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scenario = request.nextUrl.searchParams.get("scenario") ?? "";
    if (!(BAND_SCENARIOS as readonly string[]).includes(scenario)) {
      return NextResponse.json({ error: "Invalid scenario" }, { status: 400 });
    }

    const { error } = await supabase
      .from("forecast_assumptions")
      .delete()
      .eq("scenario", scenario);

    if (error) {
      console.error("Failed to reset assumptions:", error);
      return NextResponse.json(
        { error: "Failed to reset assumptions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Forecast DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to reset assumptions" },
      { status: 500 }
    );
  }
}

// Helpers

interface ForecastAssumptionRow {
  scenario: string;
  monthly_churn_pct: number;
  monthly_expansion_pct: number;
  new_logos_per_month: number;
  avg_new_deal_size: number;
  pipeline_conversion_pct: number;
}

function rowToAssumptions(row: ForecastAssumptionRow): ForecastAssumptions {
  return {
    scenario: row.scenario,
    monthlyChurnPct: Number(row.monthly_churn_pct),
    monthlyExpansionPct: Number(row.monthly_expansion_pct),
    newLogosPerMonth: row.new_logos_per_month,
    avgNewDealSize: Number(row.avg_new_deal_size),
    pipelineConversionPct: Number(row.pipeline_conversion_pct),
  };
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonthsUtil(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parsePipelineDeals(
  dealsJson: unknown
): { amount: number; probability: number; closeDate: string | null }[] {
  if (!dealsJson || !Array.isArray(dealsJson)) return [];
  return dealsJson.map((d: Record<string, unknown>) => ({
    amount: Math.round(Number(d.amount ?? 0) * 100), // whole DKK → øre
    probability: Number(d.probability ?? 0),
    closeDate: d.closedate != null ? String(d.closedate) : null,
  }));
}
