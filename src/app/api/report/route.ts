import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReportData } from "@/lib/report-data";

/**
 * GET /api/report?month=YYYY-MM
 * GET /api/report?start=YYYY-MM&end=YYYY-MM
 *
 * Returns the full aggregated ReportData for the requested period.
 *
 * Single month: ?month=2026-03
 * Range:        ?start=2026-01&end=2026-03
 *
 * For range queries:
 * - Point-in-time metrics (MRR, ARR, count, NRR): uses end month values
 * - Flow metrics (net new, decomposition, new/churned): summed across range
 *
 * Currency is always DKK from the server; the client handles conversion.
 */
export async function GET(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse period params
    const params = request.nextUrl.searchParams;
    const monthParam = params.get("month");
    const startParam = params.get("start");
    const endParam = params.get("end");

    let startMonth: string;
    let endMonth: string;

    if (startParam && endParam) {
      // Range query
      if (!isValidMonth(startParam) || !isValidMonth(endParam)) {
        return NextResponse.json(
          { error: "Invalid month format. Expected YYYY-MM." },
          { status: 400 }
        );
      }
      if (startParam > endParam) {
        return NextResponse.json(
          { error: "start must be <= end." },
          { status: 400 }
        );
      }
      startMonth = startParam;
      endMonth = endParam;
    } else {
      // Single month (default to current)
      const month = monthParam ?? getCurrentMonth();
      if (!isValidMonth(month)) {
        return NextResponse.json(
          { error: "Invalid month format. Expected YYYY-MM." },
          { status: 400 }
        );
      }
      startMonth = month;
      endMonth = month;
    }

    const data = await getReportData(startMonth, endMonth, "DKK");

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch report data:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
