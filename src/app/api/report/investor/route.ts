import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getReportData } from "@/lib/report-data";
import { computeCACPayback } from "@/lib/metrics";
import type { InvestorReportData } from "@/lib/types/investor-report";

/**
 * GET /api/report/investor?month=YYYY-MM
 *
 * Returns M&A-centric metrics for the investor dashboard.
 * Excludes: customer names, deal details, pipeline specifics, commentary.
 *
 * Accessible by: management, investor
 */
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["management", "investor"]);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const params = request.nextUrl.searchParams;
    const month = params.get("month") ?? getCurrentMonth();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    const full = await getReportData(month, month, "DKK");

    const investorData: InvestorReportData = {
      month: full.month,
      currency: full.currency,
      fxRates: full.fxRates,

      revenueQuality: {
        arr: full.revenue.arr,
        mrr: full.revenue.mrr,
        nrr: full.retention.nrr,
        grr: full.retention.grr,
        logoRetentionRate: full.retention.logoRetentionRate,
        top10Concentration: full.customers.top10Concentration,
        growthMoM: full.revenue.growthMoM,
        growthYoY: full.revenue.growthYoY,
        arrHistory: full.revenue.arrHistory,
        nrrHistory: full.retention.nrrHistory,
        customerCount: full.customers.count,
        arpa: full.customers.arpa,
        quickRatio: full.retention.quickRatio,
      },

      growthEfficiency: {
        ltv: full.unitEconomics.ltv,
        cac: full.unitEconomics.cac,
        ltvCacRatio: full.unitEconomics.ltvCacRatio,
        revenuePerEmployee: full.unitEconomics.revenuePerEmployee,
        employeeCount: full.unitEconomics.employeeCount,
        cacPaybackMonths: computeCACPayback(
          full.unitEconomics.cac,
          full.customers.arpa,
          full.unitEconomics.grossMargin
        ),
        ruleOf40: full.unitEconomics.ruleOf40,
        burnMultiple: full.unitEconomics.burnMultiple,
        magicNumber: full.unitEconomics.magicNumber,
        grossMargin: full.unitEconomics.grossMargin,
      },
    };

    return NextResponse.json(investorData);
  } catch (error) {
    console.error("Failed to fetch investor report:", error);
    return NextResponse.json(
      { error: "Failed to fetch investor report" },
      { status: 500 }
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

