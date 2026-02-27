import { NextRequest, NextResponse } from "next/server";
import { listInvoices } from "@/lib/frisbii";
import { getMonthlyRevenue } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  try {
    const months = Number(request.nextUrl.searchParams.get("months") ?? "12");
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const fromStr = from.toISOString().split("T")[0];

    const invoices = await listInvoices({
      state: "settled",
      from: fromStr,
      range: "settled",
    });

    const monthlyRevenue = getMonthlyRevenue(invoices);

    return NextResponse.json({
      monthlyRevenue,
      months,
      from: fromStr,
      to: now.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Failed to fetch revenue:", error);
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
