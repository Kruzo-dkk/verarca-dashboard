import { NextRequest, NextResponse } from "next/server";
import { listPlans, buildPlanMap } from "@/lib/frisbii";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/cron/backfill-plan-names
 *
 * One-time utility: fetches all plan names from Frisbii and updates
 * the plan_name column in both customers and customer_snapshots tables.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all plans from Frisbii
  const plans = await listPlans();
  const planMap = buildPlanMap(plans);

  console.log(`[backfill-plan-names] Loaded ${planMap.size} plans from Frisbii`);

  // Build handle → name mapping
  const updates: { handle: string; name: string }[] = [];
  for (const [handle, plan] of planMap) {
    updates.push({ handle, name: plan.name });
  }

  console.log(
    `[backfill-plan-names] Plan mapping:`,
    updates.map((u) => `${u.handle} → ${u.name}`).join(", ")
  );

  // Update customers table
  let customersUpdated = 0;
  for (const { handle, name } of updates) {
    const { data } = await supabase
      .from("customers")
      .update({ plan_name: name })
      .eq("plan_handle", handle)
      .select("id");
    customersUpdated += data?.length ?? 0;
  }

  // Update customer_snapshots table
  let snapshotsUpdated = 0;
  for (const { handle, name } of updates) {
    const { data } = await supabase
      .from("customer_snapshots")
      .update({ plan_name: name })
      .eq("plan_handle", handle)
      .select("id");
    snapshotsUpdated += data?.length ?? 0;
  }

  console.log(
    `[backfill-plan-names] Updated ${customersUpdated} customer rows, ${snapshotsUpdated} snapshot rows`
  );

  return NextResponse.json({
    plans: updates.length,
    customersUpdated,
    snapshotsUpdated,
    mapping: Object.fromEntries(updates.map((u) => [u.handle, u.name])),
  });
}
