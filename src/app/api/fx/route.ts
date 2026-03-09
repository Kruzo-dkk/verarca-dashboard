import { NextRequest, NextResponse } from "next/server";
import { fetchRates } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/fx?date=YYYY-MM-DD
 *
 * Returns FX rates (DKK-based).
 *
 * - If a date is provided and falls in a past month, returns the locked rates
 *   from the fx_rates table.
 * - If no date or the date is in the current month, returns live rates from
 *   the Frankfurter API.
 *
 * No authentication required — FX rates are non-sensitive.
 */
export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date");

    // Determine whether to use stored rates or live rates
    if (dateParam && isHistoricalMonth(dateParam)) {
      const month = dateParam.substring(0, 7); // YYYY-MM

      const supabase = await createClient();
      const { data, error } = await supabase
        .from("fx_rates")
        .select("month, eur_rate, usd_rate, locked_at")
        .eq("month", month)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch stored FX rates:", error);
        // Fall through to live fetch
      }

      if (data) {
        return NextResponse.json(
          {
            source: "stored",
            month: data.month,
            rates: { EUR: data.eur_rate, USD: data.usd_rate },
            lockedAt: data.locked_at,
          },
          {
            headers: {
              "Cache-Control": "public, max-age=86400", // 24h — historical rates do not change
            },
          }
        );
      }
    }

    // Live rates from Frankfurter API
    const rates = await fetchRates(dateParam ?? undefined);

    return NextResponse.json(
      {
        source: "live",
        date: dateParam ?? "latest",
        rates,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch FX rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch FX rates" },
      { status: 500 }
    );
  }
}

// Next.js ISR revalidation — 5-minute cache
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given date string (YYYY-MM-DD or YYYY-MM) falls
 * strictly before the current month.
 */
function isHistoricalMonth(dateStr: string): boolean {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const month = dateStr.substring(0, 7);
  return month < currentMonth;
}
