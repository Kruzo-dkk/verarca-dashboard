import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/settings?month=YYYY-MM
 *
 * Returns settings for a specific month. If no settings exist for the
 * requested month, returns defaults (zeroes).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid or missing month parameter (expected YYYY-MM)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("month", month)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }

  // Return data or defaults
  return NextResponse.json(
    data ?? {
      month,
      total_cac: 0,
      cac_outbound: null,
      cac_partner: null,
      cac_inbound: null,
      employee_count: null,
      monthly_cogs: 0,
      gross_margin_pct: null,
      monthly_burn: null,
      notes: null,
    }
  );
}

/**
 * PUT /api/settings
 *
 * Upserts settings for a given month.
 * Body: { month, total_cac?, employee_count?, notes? }
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { month, total_cac, cac_outbound, cac_partner, cac_inbound, employee_count, monthly_cogs, gross_margin_pct, monthly_burn, notes } = body;

  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: "Invalid or missing month (expected YYYY-MM)" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("settings")
    .upsert(
      {
        month,
        total_cac: total_cac ?? 0,
        cac_outbound: cac_outbound ?? null,
        cac_partner: cac_partner ?? null,
        cac_inbound: cac_inbound ?? null,
        employee_count: employee_count ?? null,
        monthly_cogs: monthly_cogs ?? 0,
        gross_margin_pct: gross_margin_pct ?? null,
        monthly_burn: monthly_burn ?? null,
        notes: notes ?? null,
      },
      { onConflict: "month" }
    )
    .select()
    .single();

  if (error) {
    console.error("Failed to save settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }

  return NextResponse.json(data);
}
