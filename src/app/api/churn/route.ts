import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyChurnFromSnapshots, type SnapshotForChurn } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  try {
    const months = Number(request.nextUrl.searchParams.get("months") ?? "12");

    const supabase = await createClient();
    const now = new Date();
    // Include one extra prior month so the oldest displayed month has a start state.
    const windowStart = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const windowStartKey = `${windowStart.getFullYear()}-${String(windowStart.getMonth() + 1).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("monthly_snapshots")
      .select("month, mrr, customer_count, churned_logos, churned_mrr")
      .gte("month", windowStartKey)
      .order("month", { ascending: true });

    if (error) throw error;

    const snapshots: SnapshotForChurn[] = (data ?? []).map((row) => ({
      month: row.month,
      mrr: row.mrr,
      customer_count: row.customer_count,
      churned_logos: row.churned_logos,
      churned_mrr: row.churned_mrr,
    }));

    const monthlyChurn = getMonthlyChurnFromSnapshots(snapshots).slice(-months);

    return NextResponse.json({
      monthlyChurn,
      months,
    });
  } catch (error) {
    console.error("Failed to fetch churn data:", error);
    return NextResponse.json(
      { error: "Failed to fetch churn data" },
      { status: 500 }
    );
  }
}
