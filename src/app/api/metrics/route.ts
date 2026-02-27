import { NextResponse } from "next/server";
import {
  listSubscriptions,
  listPlans,
  buildPlanMap,
  fetchAddOns,
} from "@/lib/frisbii";
import {
  calculateMRR,
  calculateARR,
  calculateChurnRate,
  calculateNetNewMRR,
  calculateARPC,
} from "@/lib/metrics";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthStr = startOfMonth.toISOString().split("T")[0];

    const [activeSubscriptions, expiredThisMonth, newThisMonth, plans] =
      await Promise.all([
        listSubscriptions({ state: "active" }),
        listSubscriptions({
          state: "expired",
          from: startOfMonthStr,
        }),
        listSubscriptions({
          state: "active",
          from: startOfMonthStr,
          range: "created",
        }),
        listPlans(),
      ]);

    const planMap = buildPlanMap(plans);
    const addOnMap = await fetchAddOns(activeSubscriptions);

    const mrr = calculateMRR(activeSubscriptions, planMap, addOnMap);
    const arr = calculateARR(mrr);
    const activeCustomerCount = activeSubscriptions.length;
    const churnRate = calculateChurnRate(
      expiredThisMonth,
      activeSubscriptions.length + expiredThisMonth.length
    );
    const netNewMRR = calculateNetNewMRR(
      newThisMonth,
      expiredThisMonth,
      planMap,
      addOnMap
    );
    const arpc = calculateARPC(mrr, activeCustomerCount);

    const currency = activeSubscriptions[0]?.currency ?? "DKK";

    // Round to minor currency unit (øre) at the API boundary —
    // this is the single rounding point, preserving precision through all aggregation
    return NextResponse.json({
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      activeCustomerCount,
      churnRate: Math.round(churnRate * 100) / 100,
      netNewMRR: Math.round(netNewMRR),
      arpc: Math.round(arpc),
      currency,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
