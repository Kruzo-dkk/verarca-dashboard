"use client";

import { useReportContext } from "@/components/providers/ReportProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { HeroKPIs } from "./HeroKPIs";
import { RevenueSection } from "./RevenueSection";
import { RetentionSection } from "./RetentionSection";
import { CustomerSection } from "./CustomerSection";
import { PipelineSection } from "./PipelineSection";
import { UnitEconomicsSection } from "./UnitEconomicsSection";
import { ChannelSection } from "./ChannelSection";
import { CommentarySection } from "./CommentarySection";

/**
 * ReportShell is now a pure presentational component.
 *
 * All state (month, currency, FX rates, data fetching) lives in
 * ReportProvider. The header and navigation live in AppShell.
 * This component just renders the report sections.
 */
export function ReportShell() {
  const { data, loading, error, month, currency, fxRates, formatValue } =
    useReportContext();

  return (
    <>
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
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
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
          <ChannelSection data={data} formatValue={formatValue} />
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
            <>
              {" "}
              FX rates: 1 DKK = {fxRates.EUR.toFixed(4)} EUR /{" "}
              {fxRates.USD.toFixed(4)} USD
            </>
          )}
        </p>
      </footer>
    </>
  );
}
