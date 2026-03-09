import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/commentary?month=YYYY-MM
 *
 * Returns the commentary fields for a given month from monthly_snapshots.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const month = request.nextUrl.searchParams.get("month");
    if (!month || !isValidMonth(month)) {
      return NextResponse.json(
        { error: "Missing or invalid month parameter. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("monthly_snapshots")
      .select(
        "month, executive_summary, highlights, lowlights, whats_ahead"
      )
      .eq("month", month)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch commentary:", error);
      return NextResponse.json(
        { error: "Failed to fetch commentary" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: `No snapshot found for month ${month}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      month: data.month,
      executiveSummary: data.executive_summary,
      highlights: data.highlights,
      lowlights: data.lowlights,
      whatsAhead: data.whats_ahead,
    });
  } catch (error) {
    console.error("Failed to fetch commentary:", error);
    return NextResponse.json(
      { error: "Failed to fetch commentary" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/commentary
 *
 * Update commentary fields for a given month.
 * Body: { month: string, executiveSummary?: string, highlights?: string,
 *         lowlights?: string, whatsAhead?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { month, executiveSummary, highlights, lowlights, whatsAhead } =
      body as {
        month?: string;
        executiveSummary?: string;
        highlights?: string;
        lowlights?: string;
        whatsAhead?: string;
      };

    if (!month || !isValidMonth(month)) {
      return NextResponse.json(
        { error: "Missing or invalid month in request body. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {};
    if (executiveSummary !== undefined)
      updates.executive_summary = executiveSummary;
    if (highlights !== undefined) updates.highlights = highlights;
    if (lowlights !== undefined) updates.lowlights = lowlights;
    if (whatsAhead !== undefined) updates.whats_ahead = whatsAhead;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No commentary fields provided to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("monthly_snapshots")
      .update(updates)
      .eq("month", month)
      .select(
        "month, executive_summary, highlights, lowlights, whats_ahead"
      )
      .single();

    if (error) {
      console.error("Failed to update commentary:", error);
      return NextResponse.json(
        { error: "Failed to update commentary" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      month: data.month,
      executiveSummary: data.executive_summary,
      highlights: data.highlights,
      lowlights: data.lowlights,
      whatsAhead: data.whats_ahead,
    });
  } catch (error) {
    console.error("Failed to update commentary:", error);
    return NextResponse.json(
      { error: "Failed to update commentary" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
