"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { ForecastResult } from "@/lib/forecast";
import { SCENARIO_ORDER, SCENARIO_META } from "@/lib/forecast-scenarios";

interface ForecastSummaryProps {
  data: ForecastResult;
  formatValue: (v: number) => string;
}

export function ForecastSummary({ data, formatValue }: ForecastSummaryProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {SCENARIO_ORDER.map((s) => {
        const projection = data.projections.find((p) => p.scenario === s);
        const meta = SCENARIO_META[s];
        if (!projection || !meta) return null;

        const finalMonth = projection.months[projection.months.length - 1];
        const mrrDelta = finalMonth ? finalMonth.mrr - data.currentMRR : 0;
        const mrrDeltaPercent =
          data.currentMRR > 0
            ? ((mrrDelta / data.currentMRR) * 100).toFixed(1)
            : "0.0";
        const isPositive = mrrDelta >= 0;

        return (
          <GlassCard key={s} className="relative overflow-hidden">
            {/* Colored accent bar */}
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{ backgroundColor: meta.color }}
            />

            <div className="pt-2">
              {/* Scenario label */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  {meta.label}
                </span>
                {meta.readOnly && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 px-1.5 py-0.5 rounded">
                    Auto
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mb-3">{meta.desc}</p>

              {/* Projected MRR */}
              <div className="mb-2">
                <p className="text-xs text-[var(--text-muted)]">
                  Projected MRR ({projection.months.length}M)
                </p>
                <p className="text-2xl font-bold metric-value text-[var(--text-primary)]">
                  {finalMonth ? formatValue(finalMonth.mrr) : "—"}
                </p>
              </div>

              {/* ARR */}
              <div className="mb-3">
                <p className="text-xs text-[var(--text-muted)]">Projected ARR</p>
                <p className="text-sm font-semibold metric-value text-[var(--text-primary)]">
                  {finalMonth ? formatValue(finalMonth.arr) : "—"}
                </p>
              </div>

              {/* Delta from current */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
                <span
                  className={`text-xs font-medium ${
                    isPositive ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {formatValue(mrrDelta)}
                </span>
                <span
                  className={`text-[10px] ${
                    isPositive ? "text-emerald-500" : "text-red-500"
                  }`}
                >
                  ({isPositive ? "+" : ""}
                  {mrrDeltaPercent}%)
                </span>
                <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                  vs. today
                </span>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
