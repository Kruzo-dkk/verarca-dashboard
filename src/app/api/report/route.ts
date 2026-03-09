import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReportData } from "@/lib/report-data";

/**
 * GET /api/report?month=YYYY-MM
 *
 * Returns the full aggregated ReportData for the requested month.
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

    // Parse month param — default to current month
    const monthParam = request.nextUrl.searchParams.get("month");
    const month = monthParam ?? getCurrentMonth();

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    const data = await getReportData(month, "DKK");

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
