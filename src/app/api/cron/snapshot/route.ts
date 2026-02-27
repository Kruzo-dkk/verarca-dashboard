import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

export async function GET(request: Request) {
  // Simple auth: only allow calls from localhost or with a secret
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
    const addOnMap = await fetchAddOns(activeSubscriptions);

    const mrr = Math.round(calculateMRR(activeSubscriptions, planMap, addOnMap));
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
      calculateNetNewMRR(newThisMonth, expiredThisMonth, planMap, addOnMap)
    );
    const arpc = Math.round(calculateARPC(mrr, customerCount));
    const currency = activeSubscriptions[0]?.currency ?? "DKK";

    const snapshot = await prisma.metricSnapshot.upsert({
      where: { date: new Date(today) },
      update: { mrr, arr, churnRate, customerCount, netNewMRR, arpc, currency },
      create: {
        date: new Date(today),
        mrr,
        arr,
        churnRate,
        customerCount,
        netNewMRR,
        arpc,
        currency,
      },
    });

    return NextResponse.json({
      message: "Snapshot saved",
      date: today,
      snapshot,
    });
  } catch (error) {
    console.error("Failed to create snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}
