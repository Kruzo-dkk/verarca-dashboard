"use client";

import { useState, useEffect, useCallback } from "react";
import type { Currency, FXRates } from "@/lib/currency";
import { convertFromDKK, formatAmount } from "@/lib/currency";
import type { ReportData } from "@/lib/types/report";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeroKPIs } from "./HeroKPIs";
import { RevenueSection } from "./RevenueSection";
import { RetentionSection } from "./RetentionSection";
import { CustomerSection } from "./CustomerSection";
import { PipelineSection } from "./PipelineSection";
import { UnitEconomicsSection } from "./UnitEconomicsSection";
import { CommentarySection } from "./CommentarySection";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportShell() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [currency, setCurrency] = useState<Currency>("DKK");
  const [fxRates, setFxRates] = useState<FXRates>({ EUR: 0.134, USD: 0.146 });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, fxRes] = await Promise.all([
        fetch(`/api/report?month=${month}`),
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
  }, [month]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Currency-aware formatting
  const formatValue = useCallback(
    (dkkOre: number): string => {
      const converted = convertFromDKK(dkkOre, currency, fxRates);
      return formatAmount(converted, currency);
    },
    [currency, fxRates]
  );

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="section-heading text-2xl text-[var(--text-primary)]">Verarca</h1>
            <p className="text-sm text-[var(--text-muted)]">M&A Performance Report</p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodSelector value={month} onChange={setMonth} />
            <CurrencyToggle value={currency} onChange={setCurrency} />
            <button
              onClick={fetchReport}
              disabled={loading}
              className="rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          </div>
        )}

        {/* Report sections */}
        {data && (
          <div className="space-y-10">
            <HeroKPIs data={data} formatValue={formatValue} />
            <RevenueSection data={data} formatValue={formatValue} />
            <RetentionSection data={data} />
            <CustomerSection data={data} formatValue={formatValue} />
            <PipelineSection data={data} formatValue={formatValue} />
            <UnitEconomicsSection data={data} formatValue={formatValue} />
            <CommentarySection
              month={month}
              executiveSummary={data.commentary.executiveSummary}
              highlights={data.commentary.highlights}
              lowlights={data.commentary.lowlights}
              whatsAhead={data.commentary.whatsAhead}
            />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-[var(--border-subtle)] text-center">
          <p className="text-xs text-[var(--text-muted)]">
            Data refreshed from Frisbii, HubSpot, and ClickUp.
            {currency !== "DKK" && (
              <> FX rates: 1 DKK = {fxRates.EUR.toFixed(4)} EUR / {fxRates.USD.toFixed(4)} USD</>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}
