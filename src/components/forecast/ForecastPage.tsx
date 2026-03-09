"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { ForecastSummary } from "@/components/forecast/ForecastSummary";
import { ForecastAssumptions } from "@/components/forecast/ForecastAssumptions";
import { useReportContext } from "@/components/providers/ReportProvider";
import type { ForecastResult, ForecastAssumptions as AssumptionsType } from "@/lib/forecast";

export function ForecastPage() {
  const { month, formatValue } = useReportContext();

  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState(12);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?horizon=${horizon}&month=${month}`);
      if (!res.ok) throw new Error("Failed to load forecast");
      const data: ForecastResult = await res.json();
      setForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
    setLoading(false);
  }, [horizon, month]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const handleSaveAssumption = useCallback(
    async (updated: AssumptionsType) => {
      const res = await fetch("/api/forecast", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: updated.scenario,
          monthlyChurnPct: updated.monthlyChurnPct,
          monthlyExpansionPct: updated.monthlyExpansionPct,
          newLogosPerMonth: updated.newLogosPerMonth,
          avgNewDealSize: updated.avgNewDealSize,
          pipelineConversionPct: updated.pipelineConversionPct,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Re-fetch forecast with updated assumptions
      await fetchForecast();
    },
    [fetchForecast]
  );

  if (loading && !forecast) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="section-heading text-2xl text-[var(--text-primary)]">Forecast</h1>
        <GlassCard>
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchForecast}
            className="mt-3 px-5 py-2.5 sm:px-4 sm:py-2 text-sm font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90"
          >
            Retry
          </button>
        </GlassCard>
      </div>
    );
  }

  if (!forecast) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="section-heading text-2xl text-[var(--text-primary)]">Forecast</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Scenario-based MRR projection from current trends
          </p>
        </div>

        {/* Horizon toggle */}
        <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-subtle)]">
          {[6, 12, 24].map((h) => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`px-4 py-2 sm:px-3 sm:py-1.5 text-xs font-medium rounded-md transition-all ${
                horizon === h
                  ? "bg-white text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <ForecastSummary data={forecast} formatValue={formatValue} />

      {/* Chart */}
      <GlassCard>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
          MRR Projection
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Historical data (solid) vs. projected scenarios (dashed) over {horizon} months
        </p>
        <ForecastChart data={forecast} formatValue={formatValue} />
      </GlassCard>

      {/* Editable assumptions */}
      <ForecastAssumptions
        assumptions={forecast.assumptions}
        formatValue={formatValue}
        onSave={handleSaveAssumption}
      />

      {/* Methodology note */}
      <div className="text-xs text-[var(--text-muted)] px-1">
        <p>
          <strong>Methodology:</strong> Each month projects forward from the previous month&apos;s MRR.
          Churn and expansion are applied as percentages of existing MRR. New logos are multiplied by
          the average deal size. Pipeline deals with close dates in the projected month contribute
          their weighted amount (deal size &times; conversion %).
        </p>
      </div>
    </div>
  );
}
