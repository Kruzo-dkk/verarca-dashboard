export interface FXRates {
  EUR: number;
  USD: number;
}

export type Currency = "DKK" | "EUR" | "USD";

/**
 * Fetch exchange rates from Frankfurter API (ECB data).
 * Rates are DKK-based: 1 DKK = X EUR/USD
 */
export async function fetchRates(date?: string): Promise<FXRates> {
  const dateParam = date || "latest";
  const res = await fetch(
    `https://api.frankfurter.app/${dateParam}?from=DKK&to=EUR,USD`,
    { next: { revalidate: 300 } } // 5-minute cache
  );

  if (!res.ok) {
    throw new Error(`Frankfurter API error ${res.status}`);
  }

  const data = await res.json();
  return {
    EUR: data.rates.EUR,
    USD: data.rates.USD,
  };
}

/**
 * Convert DKK minor units (ore) to target currency minor units.
 */
export function convertFromDKK(
  amountOre: number,
  targetCurrency: Currency,
  rates: FXRates
): number {
  if (targetCurrency === "DKK") return amountOre;
  const rate = rates[targetCurrency];
  return Math.round(amountOre * rate);
}

/**
 * Convert USD cents to DKK ore.
 */
export function convertUSDtoDKK(
  amountCents: number,
  rates: FXRates
): number {
  if (rates.USD === 0) return 0;
  // 1 DKK = X USD, so 1 USD = 1/X DKK
  return Math.round(amountCents / rates.USD);
}

/**
 * Convert EUR cents to DKK ore.
 */
export function convertEURtoDKK(
  amountCents: number,
  rates: FXRates
): number {
  if (rates.EUR === 0) return 0;
  return Math.round(amountCents / rates.EUR);
}

/**
 * Format minor units (ore/cents) to a locale-aware display string.
 *
 * Examples:
 *   formatAmount(123456789, "DKK") -> "kr 1.234.567"  (DKK without ore)
 *   formatAmount(16543200, "EUR")  -> "E165.432"
 *   formatAmount(17982100, "USD")  -> "$179,821"
 */
export function formatAmount(minorUnits: number, currency: Currency): string {
  const majorUnits = minorUnits / 100;

  switch (currency) {
    case "DKK":
      return `kr ${Math.round(majorUnits).toLocaleString("da-DK")}`;
    case "EUR":
      return `\u20AC${Math.round(majorUnits).toLocaleString("de-DE")}`;
    case "USD":
      return `$${Math.round(majorUnits).toLocaleString("en-US")}`;
    default:
      return `${Math.round(majorUnits).toLocaleString()}`;
  }
}

/**
 * Format a percentage value for display.
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a delta value with arrow indicator.
 * Returns { text: "+8.3% \u2191", positive: true }
 */
export function formatDelta(
  current: number,
  previous: number
): { text: string; positive: boolean; neutral: boolean } {
  if (previous === 0) return { text: "\u2014", positive: false, neutral: true };

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const abs = Math.abs(delta);
  const sign = delta >= 0 ? "+" : "-";
  const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "";

  return {
    text: `${sign}${abs.toFixed(1)}% ${arrow}`.trim(),
    positive: delta > 0,
    neutral: delta === 0,
  };
}
