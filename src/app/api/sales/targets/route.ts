import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    searchParams.get("month") ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sales_targets")
    .select("*")
    .eq("month", month)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    data ?? {
      month,
      target_new_mrr: 0,
      target_new_logos: 0,
      target_pipeline: 0,
      target_meetings: 0,
      target_calls: 0,
      use_hubspot_defaults: true,
    }
  );
}

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
  const {
    month,
    target_new_mrr,
    target_new_logos,
    target_pipeline,
    target_meetings,
    target_calls,
    use_hubspot_defaults,
  } = body;

  if (!month) {
    return NextResponse.json({ error: "month is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("sales_targets").upsert(
    {
      month,
      target_new_mrr: target_new_mrr ?? 0,
      target_new_logos: target_new_logos ?? 0,
      target_pipeline: target_pipeline ?? 0,
      target_meetings: target_meetings ?? 0,
      target_calls: target_calls ?? 0,
      use_hubspot_defaults: use_hubspot_defaults ?? true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "month" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
