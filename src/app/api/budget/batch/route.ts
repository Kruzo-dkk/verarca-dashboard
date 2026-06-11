import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUDGET_METRICS } from "@/lib/budget";

const FINANCE_KEYS = new Set(
  BUDGET_METRICS.filter((m) => m.actual === "settings").map((m) => m.key)
);
const METRIC_KEYS = new Set(BUDGET_METRICS.map((m) => m.key));
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_ENTRIES = 600;

interface BatchEntry {
  month: string;
  metricKey: string;
  field: "budget" | "actual";
  value: number | null;
}

function coerceValue(v: unknown): number | null {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return null;
  return Number(v);
}

/**
 * POST /api/budget/batch
 * Body: { entries: { month, metricKey, field: "budget"|"actual", value }[] }
 *
 * One round-trip for fill-down/right and column paste. Budget entries become a
 * single bulk upsert into budget_entries; finance-actual entries are grouped by
 * month and read-merge-written into settings (one read+write per month). Sales
 * actuals are synced and rejected, matching PUT /api/budget.
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

  let body: { entries?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "entries must be a non-empty array" }, { status: 400 });
  }
  if (body.entries.length > MAX_ENTRIES) {
    return NextResponse.json({ error: `Too many entries (max ${MAX_ENTRIES})` }, { status: 400 });
  }

  const entries: BatchEntry[] = [];
  for (const raw of body.entries as Record<string, unknown>[]) {
    const month = String(raw.month ?? "");
    const metricKey = String(raw.metricKey ?? "");
    const field = raw.field;
    if (!MONTH_RE.test(month)) {
      return NextResponse.json({ error: `Invalid month: ${month}` }, { status: 400 });
    }
    if (!METRIC_KEYS.has(metricKey)) {
      return NextResponse.json({ error: `Unknown metricKey: ${metricKey}` }, { status: 400 });
    }
    if (field !== "budget" && field !== "actual") {
      return NextResponse.json({ error: "field must be 'budget' or 'actual'" }, { status: 400 });
    }
    if (field === "actual" && !FINANCE_KEYS.has(metricKey)) {
      return NextResponse.json(
        { error: `${metricKey} actual is synced and cannot be edited` },
        { status: 400 }
      );
    }
    entries.push({ month, metricKey, field, value: coerceValue(raw.value) });
  }

  const admin = createAdminClient();
  const stamp = new Date().toISOString();

  // Budget entries → one bulk upsert.
  const budgetRows = entries
    .filter((e) => e.field === "budget")
    .map((e) => ({ month: e.month, metric_key: e.metricKey, budget: e.value, updated_at: stamp }));
  if (budgetRows.length) {
    const { error } = await admin
      .from("budget_entries")
      .upsert(budgetRows, { onConflict: "month,metric_key", defaultToNull: false });
    if (error) {
      console.error("batch budget upsert failed:", error);
      return NextResponse.json({ error: "Failed to save budgets" }, { status: 500 });
    }
  }

  // Finance-actual entries → group by month, read-merge-write settings once each
  // (read-merge keeps the untouched settings columns intact, mirroring PUT).
  const actualByMonth = new Map<string, BatchEntry[]>();
  for (const e of entries) {
    if (e.field !== "actual") continue;
    const list = actualByMonth.get(e.month) ?? [];
    list.push(e);
    actualByMonth.set(e.month, list);
  }
  for (const [month, monthEntries] of actualByMonth) {
    const { data: existing } = await admin
      .from("settings")
      .select("*")
      .eq("month", month)
      .maybeSingle();
    const merged = {
      month,
      total_cac: existing?.total_cac ?? 0,
      cac_outbound: existing?.cac_outbound ?? null,
      cac_partner: existing?.cac_partner ?? null,
      cac_inbound: existing?.cac_inbound ?? null,
      employee_count: existing?.employee_count ?? null,
      monthly_cogs: existing?.monthly_cogs ?? 0,
      gross_margin_pct: existing?.gross_margin_pct ?? null,
      monthly_burn: existing?.monthly_burn ?? null,
      notes: existing?.notes ?? null,
    };
    for (const e of monthEntries) {
      (merged as Record<string, number | string | null>)[e.metricKey] = e.value;
    }
    const { error } = await admin.from("settings").upsert(merged, { onConflict: "month" });
    if (error) {
      console.error("batch settings upsert failed:", error);
      return NextResponse.json({ error: "Failed to save actuals" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, written: entries.length });
}
