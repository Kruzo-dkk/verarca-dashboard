import { NextResponse } from "next/server";
import { listSubscriptions, listPlans, type Plan } from "@/lib/frisbii";
import { getSubscriptionBreakdown } from "@/lib/metrics";

export async function GET() {
  try {
    const [subscriptions, plans] = await Promise.all([
      listSubscriptions({ state: "active" }),
      listPlans(),
    ]);

    const planMap = new Map<string, Plan>(plans.map((p) => [p.handle, p]));
    const breakdown = getSubscriptionBreakdown(subscriptions, planMap);

    return NextResponse.json({
      breakdown,
      totalActive: subscriptions.length,
    });
  } catch (error) {
    console.error("Failed to fetch subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription data" },
      { status: 500 }
    );
  }
}
