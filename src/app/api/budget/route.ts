import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMonths, BUDGET_METRICS } from "@/lib/budget";

const FINANCE_KEYS = new Set(
  BUDGET_METRICS.filter((m) => m.actual === "settings").map((m) => m.key)
);
const METRIC_KEYS = new Set(BUDGET_METRICS.map((m) => m.key));
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTHS_AHEAD = 24;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthsInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 600) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

/**
 * GET /api/budget
 *
 * Returns the full budgeting grid: month window (earliest data → current+24),
 * budgets (budget_entries), finance actuals (settings) and synced sales actuals
 * (monthly_snapshots / pipeline_snapshots / activity_snapshots). The client
 * computes roll-ups/YTD via the pure helpers in lib/budget.
 *
 * Side effect: auto-prefills the current month's budget from the prior month on
 * the first load after a month rollover (idempotent).
 */
export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const cur = currentMonth();
  const endMonth = addMonths(cur, MONTHS_AHEAD);

  const [budgetRes, settingsRes, snapRes, pipeRes, actRes] = await Promise.all([
    admin.from("budget_entries").select("month, metric_key, budget"),
    admin
      .from("settings")
      .select(
        "month, gross_margin_pct, monthly_cogs, monthly_burn, total_cac, cac_outbound, cac_partner, cac_inbound, employee_count"
      ),
    admin.from("monthly_snapshots").select("month, new_mrr, new_logos"),
    admin.from("pipeline_snapshots").select("month, total_pipeline_value"),
    admin.from("activity_snapshots").select("date, calls_made, meetings_booked"),
  ]);

  const budgets: Record<string, Record<string, number>> = {};
  for (const r of budgetRes.data ?? []) {
    if (r.budget == null) continue;
    (budgets[r.month] ??= {})[r.metric_key] = Number(r.budget);
  }

  const financeActuals: Record<string, Record<string, number>> = {};
  for (const r of settingsRes.data ?? []) {
    const row: Record<string, number> = {};
    for (const k of FINANCE_KEYS) {
      const v = (r as Record<string, unknown>)[k];
      if (v != null) row[k] = Number(v);
    }
    if (Object.keys(row).length) financeActuals[r.month] = row;
  }

  const salesActuals: Record<string, Record<string, number>> = {};
  const put = (month: string, key: string, v: number | null) => {
    if (v == null) return;
    (salesActuals[month] ??= {})[key] = Number(v);
  };
  for (const r of snapRes.data ?? []) {
    put(r.month, "target_new_mrr", r.new_mrr);
    put(r.month, "target_new_logos", r.new_logos);
  }
  for (const r of pipeRes.data ?? []) {
    put(r.month, "target_pipeline", r.total_pipeline_value);
  }
  // activity is per-day → aggregate to month
  const actAgg: Record<string, { calls: number; meetings: number }> = {};
  for (const r of actRes.data ?? []) {
    const m = String(r.date).slice(0, 7);
    const a = (actAgg[m] ??= { calls: 0, meetings: 0 });
    a.calls += r.calls_made ?? 0;
    a.meetings += r.meetings_booked ?? 0;
  }
  for (const [m, a] of Object.entries(actAgg)) {
    put(m, "target_calls", a.calls);
    put(m, "target_meetings", a.meetings);
  }

  // Auto-prefill on rollover: if the current month has no budget yet, carry the
  // previous month's budget forward (idempotent).
  if (!budgets[cur] || Object.keys(budgets[cur]).length === 0) {
    const prev = addMonths(cur, -1);
    const prevBudget = budgets[prev];
    if (prevBudget && Object.keys(prevBudget).length) {
      const stamp = new Date().toISOString();
      const rows = Object.entries(prevBudget).map(([metric_key, budget]) => ({
        month: cur,
        metric_key,
        budget,
        updated_at: stamp,
      }));
      await admin
        .from("budget_entries")
        .upsert(rows, { onConflict: "month,metric_key", ignoreDuplicates: true, defaultToNull: false });
      budgets[cur] = { ...prevBudget };
    }
  }

  // Month window: earliest data month → current+24.
  const dataMonths = [
    ...Object.keys(budgets),
    ...Object.keys(financeActuals),
    ...Object.keys(salesActuals),
  ].filter((m) => MONTH_RE.test(m));
  const startMonth = dataMonths.length
    ? dataMonths.reduce((a, b) => (a < b ? a : b))
    : addMonths(cur, -12);
  const months = monthsInclusive(startMonth < cur ? startMonth : cur, endMonth);

  return NextResponse.json({
    months,
    currentMonth: cur,
    budgets,
    financeActuals,
    salesActuals,
  });
}

/**
 * PUT /api/budget
 * Body: { month, metricKey, field: "budget" | "actual", value: number | null }
 * - field "budget" → upsert budget_entries
 * - field "actual" → update the settings column (finance metrics only; sales
 *   actuals are synced/read-only)
 */
export async function PUT(request: NextRequest) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { month?: string; metricKey?: string; field?: string; value?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { month, metricKey, field } = body;
  const value =
    body.value === null || body.value === undefined || Number.isNaN(Number(body.value))
      ? null
      : Number(body.value);

  if (!month || !MONTH_RE.test(month)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  }
  if (!metricKey || !METRIC_KEYS.has(metricKey)) {
    return NextResponse.json({ error: "Unknown metricKey" }, { status: 400 });
  }
  if (field !== "budget" && field !== "actual") {
    return NextResponse.json({ error: "field must be 'budget' or 'actual'" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (field === "budget") {
    const { error } = await admin
      .from("budget_entries")
      .upsert(
        [{ month, metric_key: metricKey, budget: value, updated_at: new Date().toISOString() }],
        { onConflict: "month,metric_key", defaultToNull: false }
      );
    if (error) {
      console.error("budget upsert failed:", error);
      return NextResponse.json({ error: "Failed to save budget" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // field === "actual" — finance only
  if (!FINANCE_KEYS.has(metricKey)) {
    return NextResponse.json(
      { error: "This metric's actual is synced and cannot be edited" },
      { status: 400 }
    );
  }
  // Read-merge-write so we never clobber the other settings columns.
  const { data: e } = await admin
    .from("settings")
    .select("*")
    .eq("month", month)
    .maybeSingle();
  const merged = {
    month,
    total_cac: e?.total_cac ?? 0,
    cac_outbound: e?.cac_outbound ?? null,
    cac_partner: e?.cac_partner ?? null,
    cac_inbound: e?.cac_inbound ?? null,
    employee_count: e?.employee_count ?? null,
    monthly_cogs: e?.monthly_cogs ?? 0,
    gross_margin_pct: e?.gross_margin_pct ?? null,
    monthly_burn: e?.monthly_burn ?? null,
    notes: e?.notes ?? null,
  };
  (merged as Record<string, number | string | null>)[metricKey] = value;
  const { error } = await admin
    .from("settings")
    .upsert(merged, { onConflict: "month" });
  if (error) {
    console.error("settings actual upsert failed:", error);
    return NextResponse.json({ error: "Failed to save actual" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
