import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
} from "@/lib/frisbii";
import {
  calculateMRR,
  calculateARR,
  calculateChurnRate,
  calculateNetNewMRR,
  calculateARPC,
} from "@/lib/metrics";
import { runMonthlySyncAll } from "@/lib/sync/sync-monthly";
import { syncMonthlySnapshot } from "@/lib/sync/sync-frisbii";
import { runAlertChecks } from "@/lib/sync/run-alerts";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthsAgo(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];
    const month = getCurrentMonth();

    // --- Daily metric snapshot (existing) ---
    const [activeSubscriptions, expiredThisMonth, newThisMonth, plans] =
      await Promise.all([
        listSubscriptions({ state: "active" }),
        listSubscriptions({ state: "expired", from: startOfMonthStr }),
        listSubscriptions({
          state: "active",
          from: startOfMonthStr,
          range: "created",
        }),
        listPlans(),
      ]);

    const planMap = buildPlanMap(plans);
    const addOnTotals = await fetchSubscriptionAddOnTotals(activeSubscriptions);

    const mrr = Math.round(
      calculateMRR(activeSubscriptions, planMap, addOnTotals)
    );
    const arr = Math.round(calculateARR(mrr));
    const customerCount = activeSubscriptions.length;
    const churnRate =
      Math.round(
        calculateChurnRate(
          expiredThisMonth,
          activeSubscriptions.length + expiredThisMonth.length
        ) * 100
      ) / 100;
    const netNewMRR = Math.round(
      calculateNetNewMRR(newThisMonth, expiredThisMonth, planMap, addOnTotals)
    );
    const arpc = Math.round(calculateARPC(mrr, customerCount));
    const currency = activeSubscriptions[0]?.currency ?? "DKK";

    const supabase = createAdminClient();

    const { data: snapshot, error: dbError } = await supabase
      .from("metric_snapshots")
      .upsert(
        {
          date: today,
          mrr,
          arr,
          churn_rate: churnRate,
          customer_count: customerCount,
          net_new_mrr: netNewMRR,
          arpc,
          currency,
        },
        { onConflict: "date" }
      )
      .select()
      .single();

    if (dbError) throw dbError;

    // --- Monthly M&A report sync (FX, pipeline, customers, snapshots) ---
    console.info(`[cron] Starting monthly sync for ${month}...`);
    const syncSummary = await runMonthlySyncAll(month);
    console.info(`[cron] Monthly sync complete:`, JSON.stringify(syncSummary, null, 2));

    // Recompute the prior 2 months' aggregates so churn/MRR logic or
    // customer-link changes don't leave history stale (the monthly sync above
    // only touches the current month). Cheap: re-aggregates existing
    // customer_snapshots; respects locked_at.
    const recomputed: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const m = monthsAgo(month, i);
      try {
        await syncMonthlySnapshot(m);
        recomputed.push(m);
      } catch (err) {
        console.error(`[cron] recompute ${m} failed:`, err);
      }
    }

    // Threshold alerts: detect breaches for the current month, persist new ones
    // (deduped on month+rule) and email them. Best-effort — never fails the cron.
    const alerts = await runAlertChecks(month);

    return NextResponse.json({
      message: "Snapshot saved + monthly sync complete",
      date: today,
      month,
      recomputed,
      alerts,
      snapshot,
      sync: syncSummary,
    });
  } catch (error) {
    console.error("Failed to create snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
