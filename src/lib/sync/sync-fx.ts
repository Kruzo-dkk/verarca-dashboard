import { fetchRates } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sync FX rates for a given month into the `fx_rates` table.
 *
 * Fetches EUR and USD rates (relative to DKK) from the Frankfurter API
 * and upserts them keyed by month.
 *
 * @param month - YYYY-MM format
 */
export async function syncFXRates(month: string): Promise<void> {
  console.log(`[sync-fx] Starting FX rate sync for ${month}`);

  // Use the last day of the month for the rate lookup so we get
  // the most representative rate for a completed month.
  // For the current/future month, "latest" is used automatically by fetchRates().
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const lastDay = new Date(year, monthNum, 0); // day 0 of next month = last day of this month
  const today = new Date();

  // If the month hasn't ended yet, fetch latest rates; otherwise fetch end-of-month
  const dateParam =
    lastDay > today
      ? undefined
      : `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;

  const rates = await fetchRates(dateParam);
  console.log(`[sync-fx] Fetched rates: EUR=${rates.EUR}, USD=${rates.USD}`);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("fx_rates")
    .upsert(
      {
        month,
        eur_rate: rates.EUR,
        usd_rate: rates.USD,
        locked_at: new Date().toISOString(),
      },
      { onConflict: "month" }
    );

  if (error) {
    console.error(`[sync-fx] Upsert failed:`, error);
    throw new Error(`[sync-fx] Upsert failed: ${error.message}`);
  }

  console.log(`[sync-fx] Successfully synced FX rates for ${month}`);
}
