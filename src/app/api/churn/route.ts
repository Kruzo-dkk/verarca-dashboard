import { NextRequest, NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/frisbii";
import { getMonthlyChurn } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  try {
    const months = Number(request.nextUrl.searchParams.get("months") ?? "12");

    // Fetch all subscriptions (active + expired) so we can compute historical churn.
    // We need the full history to know how many were active at the start of each month.
    const [active, expired] = await Promise.all([
      listSubscriptions({ state: "active" }),
      listSubscriptions({ state: "expired" }),
    ]);

    const allSubscriptions = [...active, ...expired];
    const monthlyChurn = getMonthlyChurn(allSubscriptions, months);

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
