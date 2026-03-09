"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { CohortHeatmap } from "@/components/charts/CohortHeatmap";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricKey } from "@/lib/tooltip-registry";
import type { ReportData } from "@/lib/types/report";

interface RetentionSectionProps {
  data: ReportData;
}

export function RetentionSection({ data }: RetentionSectionProps) {
  const metrics: {
    label: string;
    metric: MetricKey;
    value: number | null;
    format: (v: number) => string;
    benchmark: string;
    isGood: boolean;
  }[] = [
    {
      label: "Net Revenue Retention",
      metric: "nrr",
      value: data.retention.nrr,
      format: (v: number) => `${v.toFixed(1)}%`,
      benchmark: "Best-in-class: >120%",
      isGood: data.retention.nrr !== null && data.retention.nrr >= 100,
    },
    {
      label: "Gross Revenue Retention",
      metric: "grr",
      value: data.retention.grr,
      format: (v: number) => `${v.toFixed(1)}%`,
      benchmark: "Best-in-class: >90%",
      isGood: data.retention.grr !== null && data.retention.grr >= 90,
    },
    {
      label: "Logo Retention Rate",
      metric: "logoRetentionRate",
      value: data.retention.logoRetentionRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      benchmark: "Target: >90%",
      isGood: data.retention.logoRetentionRate !== null && data.retention.logoRetentionRate >= 90,
    },
    {
      label: "Quick Ratio",
      metric: "quickRatio",
      value: data.retention.quickRatio,
      format: (v: number) => v === Infinity ? "∞" : v.toFixed(2),
      benchmark: ">4 excellent, >2 good",
      isGood: data.retention.quickRatio !== null && data.retention.quickRatio >= 2,
    },
  ];

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Retention</h2>

      {/* Gauge cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
        {metrics.map((m) => (
          <GlassCard key={m.label} className="text-center">
            <MetricTooltip metric={m.metric}>
              <span className="text-xs text-[var(--text-muted)]">{m.label}</span>
            </MetricTooltip>
            <div className={`metric-value text-2xl mt-2 ${m.isGood ? "text-emerald-600" : m.value !== null ? "text-amber-600" : "text-[var(--text-muted)]"}`}>
              {m.value !== null ? m.format(m.value) : "—"}
            </div>
            <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{m.benchmark}</span>
          </GlassCard>
        ))}
      </div>

      {/* Cohort heatmap */}
      <GlassCard>
        <MetricTooltip metric="cohortRetention">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Cohort Retention</h3>
        </MetricTooltip>
        <CohortHeatmap data={data.retention.cohortData} />
      </GlassCard>
    </section>
  );
}
