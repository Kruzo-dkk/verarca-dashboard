import { NextResponse } from "next/server";
import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchSubscriptionAddOnTotals,
} from "@/lib/frisbii";
import { getSubscriptionBreakdown } from "@/lib/metrics";

export async function GET() {
  try {
    const [subscriptions, plans] = await Promise.all([
      listSubscriptions({ state: "active" }),
      listPlans(),
    ]);

    const planMap = buildPlanMap(plans);
    const addOnTotals = await fetchSubscriptionAddOnTotals(subscriptions);
    const breakdown = getSubscriptionBreakdown(subscriptions, planMap, addOnTotals);

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
