"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Currency, FXRates } from "@/lib/currency";
import { convertFromDKK, formatAmount } from "@/lib/currency";
import type { ReportData } from "@/lib/types/report";
import type { PeriodDescriptor } from "@/lib/types/period";
import { monthPeriod, periodFromParams, periodToParams } from "@/lib/period";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ReportContextValue {
  /** Selected period (month, trailing, quarter, year) */
  period: PeriodDescriptor;
  /** Shorthand: the end month of the current period (for components that only need YYYY-MM) */
  month: string;
  /** Display currency */
  currency: Currency;
  /** FX rates: 1 DKK = X EUR/USD */
  fxRates: FXRates;
  /** Aggregated report data for the selected period */
  data: ReportData | null;
  /** Whether the report is currently loading */
  loading: boolean;
  /** Error message if the report failed to load */
  error: string | null;

  /** Update the selected period (persists to URL) */
  setPeriod: (period: PeriodDescriptor) => void;
  /** Update the display currency (persists to URL) */
  setCurrency: (currency: Currency) => void;
  /** Convert DKK øre to display currency and format */
  formatValue: (dkkOre: number) => string;
  /** Manually trigger a report refresh */
  refresh: () => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReportContext(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) {
    throw new Error("useReportContext must be used within a <ReportProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CURRENCIES: Currency[] = ["DKK", "EUR", "USD"];

function parseCurrency(raw: string | null): Currency {
  if (raw && VALID_CURRENCIES.includes(raw as Currency)) {
    return raw as Currency;
  }
  return "DKK";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReportProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise from URL search params
  const [period, setPeriodState] = useState<PeriodDescriptor>(() =>
    periodFromParams(searchParams)
  );
  const [currency, setCurrencyState] = useState<Currency>(() =>
    parseCurrency(searchParams.get("currency"))
  );
  const [fxRates, setFxRates] = useState<FXRates>({ EUR: 0.134, USD: 0.146 });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state changes back to URL search params
  const pushParams = useCallback(
    (p: PeriodDescriptor, c: Currency) => {
      const periodParams = periodToParams(p);
      const params = new URLSearchParams();

      // Period params (month or start+end)
      for (const [k, v] of Object.entries(periodParams)) {
        params.set(k, v);
      }

      // Currency (only if non-default)
      if (c !== "DKK") {
        params.set("currency", c);
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router]
  );

  const setPeriod = useCallback(
    (p: PeriodDescriptor) => {
      setPeriodState(p);
      pushParams(p, currency);
    },
    [currency, pushParams]
  );

  const setCurrency = useCallback(
    (c: Currency) => {
      setCurrencyState(c);
      pushParams(period, c);
    },
    [period, pushParams]
  );

  // Build API URL based on period type
  const buildReportUrl = useCallback((p: PeriodDescriptor): string => {
    if (p.type === "month") {
      return `/api/report?month=${p.endMonth}`;
    }
    return `/api/report?start=${p.startMonth}&end=${p.endMonth}`;
  }, []);

  // Fetch report data whenever period changes
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, fxRes] = await Promise.all([
        fetch(buildReportUrl(period)),
        fetch(`/api/fx`),
      ]);

      if (!reportRes.ok) throw new Error("Failed to load report data");
      const reportData = await reportRes.json();
      setData(reportData);

      if (fxRes.ok) {
        const fxData = await fxRes.json();
        const rates = fxData.rates ?? fxData;
        if (rates.EUR && rates.USD) {
          setFxRates(rates);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [period, buildReportUrl]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Currency-aware formatting: DKK øre → display string
  const formatValue = useCallback(
    (dkkOre: number): string => {
      const converted = convertFromDKK(dkkOre, currency, fxRates);
      return formatAmount(converted, currency);
    },
    [currency, fxRates]
  );

  const value: ReportContextValue = {
    period,
    month: period.endMonth,
    currency,
    fxRates,
    data,
    loading,
    error,
    setPeriod,
    setCurrency,
    formatValue,
    refresh: fetchReport,
  };

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
}
