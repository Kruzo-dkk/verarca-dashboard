import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_METRICS, addMonths } from "@/lib/budget";

const FINANCE_KEYS = BUDGET_METRICS.filter((m) => m.actual === "settings").map((m) => m.key);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Assemble the actuals "of record" for a month: finance from settings + synced
 * sales metrics from the snapshot tables (same sources the GET reads), frozen
 * at close time.
 */
async function assembleMonthActuals(admin: Admin, month: string): Promise<Record<string, number>> {
  const nextFirst = `${addMonths(month, 1)}-01`;
  const [settingsRes, snapRes, pipeRes, actRes] = await Promise.all([
    admin
      .from("settings")
      .select(
        "gross_margin_pct, monthly_cogs, monthly_burn, total_cac, cac_outbound, cac_partner, cac_inbound, employee_count"
      )
      .eq("month", month)
      .maybeSingle(),
    admin.from("monthly_snapshots").select("new_mrr, new_logos").eq("month", month).maybeSingle(),
    admin
      .from("pipeline_snapshots")
      .select("total_pipeline_value")
      .eq("month", month)
      .maybeSingle(),
    admin
      .from("activity_snapshots")
      .select("calls_made, meetings_booked")
      .gte("date", `${month}-01`)
      .lt("date", nextFirst),
  ]);

  const out: Record<string, number> = {};
  const sv = settingsRes.data as Record<string, unknown> | null;
  if (sv) {
    for (const k of FINANCE_KEYS) {
      const v = sv[k];
      if (v != null) out[k] = Number(v);
    }
  }
  if (snapRes.data?.new_mrr != null) out.target_new_mrr = Number(snapRes.data.new_mrr);
  if (snapRes.data?.new_logos != null) out.target_new_logos = Number(snapRes.data.new_logos);
  if (pipeRes.data?.total_pipeline_value != null)
    out.target_pipeline = Number(pipeRes.data.total_pipeline_value);
  if (actRes.data?.length) {
    let calls = 0;
    let meetings = 0;
    for (const r of actRes.data) {
      calls += r.calls_made ?? 0;
      meetings += r.meetings_booked ?? 0;
    }
    out.target_calls = calls;
    out.target_meetings = meetings;
  }
  return out;
}

/**
 * POST /api/budget/close  Body: { month }
 *
 * Closes a month: snapshots the live budget → budget_plan_of_record and the
 * live actuals → actuals_of_record, then sets the month status to 'closed'.
 * Idempotent — re-closing refreshes the snapshot. Actuals are self-attested
 * (no ERP); budgets stay editable as a re-forecast layer.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { month?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const month = String(body.month ?? "");
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }

  const admin = createAdminClient();
  const closedAt = new Date().toISOString();

  // 1. Plan of record ← live budget_entries.
  const { data: budgetRows } = await admin
    .from("budget_entries")
    .select("metric_key, budget")
    .eq("month", month);
  const planRows = (budgetRows ?? [])
    .filter((r) => r.budget != null)
    .map((r) => ({ month, metric_key: r.metric_key, budget: r.budget, closed_at: closedAt }));
  if (planRows.length) {
    const { error } = await admin
      .from("budget_plan_of_record")
      .upsert(planRows, { onConflict: "month,metric_key" });
    if (error) {
      console.error("plan_of_record upsert failed:", error);
      return NextResponse.json({ error: "Failed to snapshot plan" }, { status: 500 });
    }
  }

  // 2. Actuals of record ← live finance + synced actuals.
  const actuals = await assembleMonthActuals(admin, month);
  const actualRows = Object.entries(actuals).map(([metric_key, actual]) => ({
    month,
    metric_key,
    actual,
    closed_at: closedAt,
  }));
  if (actualRows.length) {
    const { error } = await admin
      .from("actuals_of_record")
      .upsert(actualRows, { onConflict: "month,metric_key" });
    if (error) {
      console.error("actuals_of_record upsert failed:", error);
      return NextResponse.json({ error: "Failed to snapshot actuals" }, { status: 500 });
    }
  }

  // 3. Mark closed.
  const { error: statusError } = await admin
    .from("budget_month_status")
    .upsert(
      { month, status: "closed", closed_at: closedAt, closed_by: user.email ?? null },
      { onConflict: "month" }
    );
  if (statusError) {
    console.error("month status upsert failed:", statusError);
    return NextResponse.json({ error: "Failed to close month" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    month,
    planMetrics: planRows.length,
    actualMetrics: actualRows.length,
  });
}
