import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * POST /api/budget/reopen  Body: { month }
 *
 * Reopens a closed month so its actuals are editable again. The plan-of-record
 * and actuals-of-record snapshots are kept as history (they show what was
 * attested at the last close).
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
  const { error } = await admin
    .from("budget_month_status")
    .upsert({ month, status: "open", closed_at: null, closed_by: null }, { onConflict: "month" });
  if (error) {
    console.error("reopen failed:", error);
    return NextResponse.json({ error: "Failed to reopen month" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, month });
}
