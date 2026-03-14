"use client";

import { useState, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  type BenchmarkSource,
  type ARRStage,
  type BenchmarkMetricKey,
  type BenchmarkValue,
  BENCHMARK_DATA,
  BENCHMARK_METRICS,
  ARR_STAGES,
  ARR_STAGE_LABELS,
  detectARRStage,
  getBenchmarksForStage,
  benchmarkColor,
} from "@/lib/benchmarks";

// ─── Types ──────────────────────────────────────────────────────

interface BenchmarkSectionProps {
  /** ARR in DKK øre — used to auto-detect stage */
  arrDKKOre: number;
  /** Company metrics to compare. Keys are BenchmarkMetricKeys, values are the company's values. */
  companyMetrics: Partial<Record<BenchmarkMetricKey, number | null>>;
  /** Format monetary values for display */
  formatValue: (v: number) => string;
}

// ─── Component ──────────────────────────────────────────────────

export function BenchmarkSection({
  arrDKKOre,
  companyMetrics,
  formatValue,
}: BenchmarkSectionProps) {
  const autoStage = detectARRStage(arrDKKOre);
  const [source, setSource] = useState<BenchmarkSource>("bessemer");
  const [stage, setStage] = useState<ARRStage>(autoStage);

  const benchmarks = useMemo(
    () => getBenchmarksForStage(source, stage),
    [source, stage]
  );

  // Metrics to display: show all metrics that appear in either the benchmarks or company data
  const metricsToShow = useMemo(() => {
    const keys = new Set<BenchmarkMetricKey>();
    if (benchmarks) {
      for (const key of Object.keys(benchmarks.metrics) as BenchmarkMetricKey[]) {
        keys.add(key);
      }
    }
    // Also show company metrics even if not in benchmark source
    for (const key of Object.keys(companyMetrics) as BenchmarkMetricKey[]) {
      if (companyMetrics[key] !== undefined && companyMetrics[key] !== null) {
        keys.add(key);
      }
    }
    // Sort by the order in BENCHMARK_METRICS
    const allKeys: BenchmarkMetricKey[] = [
      "nrr", "grr", "logoRetention", "growthRate",
      "ltvCac", "cacPayback", "ruleOf40", "burnMultiple",
      "magicNumber", "grossMargin",
    ];
    return allKeys.filter((k) => keys.has(k));
  }, [benchmarks, companyMetrics]);

  // Available stages for the selected source
  const availableStages = useMemo(() => {
    const sourceData = BENCHMARK_DATA.find((d) => d.source === source);
    return sourceData?.stages.map((s) => s.stage) ?? [];
  }, [source]);

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
        Benchmark Comparison
      </h2>

      {/* Controls */}
      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Source selector */}
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Source
            </label>
            <div className="flex gap-1">
              {BENCHMARK_DATA.map((d) => (
                <button
                  key={d.source}
                  onClick={() => setSource(d.source)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    source === d.source
                      ? "bg-[var(--accent-teal)] text-white"
                      : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {d.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Stage selector */}
          <div>
            <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
              ARR Stage
              {stage === autoStage && (
                <span className="ml-1 text-[var(--accent-teal)]">(auto)</span>
              )}
            </label>
            <div className="flex gap-1 flex-wrap">
              {ARR_STAGES.filter(
                (s) => s !== "0-1M" && s !== "50M+" // No benchmark data for these
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setStage(s)}
                  disabled={!availableStages.includes(s)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    stage === s
                      ? "bg-[var(--accent-teal)] text-white"
                      : availableStages.includes(s)
                        ? "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        : "bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  }`}
                >
                  {ARR_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Benchmark comparison table */}
      {benchmarks ? (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium text-right">Your Value</th>
                  <th className="pb-2 font-medium text-right">Median</th>
                  <th className="pb-2 font-medium text-right">Top Quartile</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">
                    Standing
                  </th>
                </tr>
              </thead>
              <tbody>
                {metricsToShow.map((metricKey) => {
                  const meta = BENCHMARK_METRICS[metricKey];
                  const benchmark = benchmarks.metrics[metricKey];
                  const companyVal = companyMetrics[metricKey] ?? null;

                  return (
                    <BenchmarkRow
                      key={metricKey}
                      label={meta.label}
                      format={meta.format}
                      higherIsBetter={meta.higherIsBetter}
                      companyValue={companyVal}
                      benchmark={benchmark ?? null}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] mt-4">
            Source: {BENCHMARK_DATA.find((d) => d.source === source)?.label} ({
              BENCHMARK_DATA.find((d) => d.source === source)?.year
            }) • {ARR_STAGE_LABELS[stage]}
          </p>
        </GlassCard>
      ) : (
        <GlassCard>
          <div className="flex items-center justify-center h-32 text-sm text-[var(--text-muted)]">
            No benchmark data available for this source and stage combination.
          </div>
        </GlassCard>
      )}
    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function BenchmarkRow({
  label,
  format,
  higherIsBetter,
  companyValue,
  benchmark,
}: {
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
  companyValue: number | null;
  benchmark: BenchmarkValue | null;
}) {
  // Color the company value based on benchmark position
  let colorClass = "text-[var(--text-primary)]";
  let standingLabel = "—";

  if (companyValue !== null && benchmark) {
    colorClass = benchmarkColor(companyValue, benchmark, higherIsBetter);

    if (higherIsBetter) {
      if (companyValue >= benchmark.topQuartile) standingLabel = "Top Quartile";
      else if (companyValue >= benchmark.median) standingLabel = "Above Median";
      else standingLabel = "Below Median";
    } else {
      if (companyValue <= benchmark.topQuartile) standingLabel = "Top Quartile";
      else if (companyValue <= benchmark.median) standingLabel = "Above Median";
      else standingLabel = "Below Median";
    }
  }

  return (
    <tr className="border-b border-[var(--border-subtle)] last:border-b-0">
      <td className="py-2.5 text-[var(--text-primary)] font-medium">
        {label}
      </td>
      <td className={`py-2.5 text-right metric-value ${colorClass}`}>
        {companyValue !== null ? format(companyValue) : "—"}
      </td>
      <td className="py-2.5 text-right text-[var(--text-secondary)]">
        {benchmark ? format(benchmark.median) : "—"}
      </td>
      <td className="py-2.5 text-right text-[var(--text-secondary)]">
        {benchmark ? format(benchmark.topQuartile) : "—"}
      </td>
      <td className="py-2.5 text-right hidden sm:table-cell">
        {companyValue !== null && benchmark ? (
          <span
            className={`inline-block px-2 py-0.5 text-xs rounded-full ${
              standingLabel === "Top Quartile"
                ? "bg-emerald-100 text-emerald-700"
                : standingLabel === "Above Median"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {standingLabel}
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </td>
    </tr>
  );
}
