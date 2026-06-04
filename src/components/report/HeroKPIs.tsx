"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { SparkLine } from "@/components/charts/SparkLine";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { KPIDrilldown, hasDrilldown } from "./KPIDrilldown";
import type { MetricKey } from "@/lib/tooltip-registry";
import type { ReportData } from "@/lib/types/report";

interface HeroKPIsProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function HeroKPIs({ data, formatValue }: HeroKPIsProps) {
  const [expanded, setExpanded] = useState<MetricKey | null>(null);

  const kpis: {
    label: string;
    metric: MetricKey;
    value: string;
    sparkData: { value: number }[];
    current: number;
    previous: number | null;
  }[] = [
    {
      label: "ARR",
      metric: "arr",
      value: formatValue(data.revenue.arr),
      sparkData: data.revenue.arrHistory.map((h) => ({ value: h.arr })),
      current: data.revenue.arr,
      previous: data.revenue.arrHistory.length >= 2
        ? data.revenue.arrHistory[data.revenue.arrHistory.length - 2]?.arr ?? null
        : null,
    },
    {
      label: "MRR",
      metric: "mrr",
      value: formatValue(data.revenue.mrr),
      sparkData: data.revenue.mrrHistory.map((h) => ({ value: h.mrr })),
      current: data.revenue.mrr,
      previous: data.revenue.mrrHistory.length >= 2
        ? data.revenue.mrrHistory[data.revenue.mrrHistory.length - 2]?.mrr ?? null
        : null,
    },
    {
      label: "Net New MRR",
      metric: "netNewMRR",
      value: formatValue(data.revenue.netNewMRR),
      sparkData: [],
      current: data.revenue.netNewMRR,
      previous: null,
    },
    {
      label: "NRR",
      metric: "nrr",
      value: data.retention.nrr !== null ? `${data.retention.nrr.toFixed(1)}%` : "—",
      sparkData: data.retention.nrrHistory.map((h) => ({ value: h.nrr })),
      current: data.retention.nrr ?? 0,
      previous: data.retention.nrrHistory.length >= 2
        ? data.retention.nrrHistory[data.retention.nrrHistory.length - 2]?.nrr ?? null
        : null,
    },
    {
      label: "Active Customers",
      metric: "activeCustomers",
      value: data.customers.count.toLocaleString(),
      sparkData: data.customers.countHistory.map((h) => ({ value: h.count })),
      current: data.customers.count,
      previous: data.customers.countHistory.length >= 2
        ? data.customers.countHistory[data.customers.countHistory.length - 2]?.count ?? null
        : null,
    },
    {
      label: "Quick Ratio",
      metric: "quickRatio",
      value: data.retention.quickRatio !== null
        ? data.retention.quickRatio === Infinity ? "∞" : data.retention.quickRatio.toFixed(1)
        : "—",
      sparkData: [],
      current: data.retention.quickRatio ?? 0,
      previous: null,
    },
  ];

  const expandedKpi = kpis.find((k) => k.metric === expanded) ?? null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const drillable = hasDrilldown(kpi.metric);
          const isOpen = expanded === kpi.metric;
          return (
            <GlassCard
              key={kpi.label}
              onClick={drillable ? () => setExpanded(isOpen ? null : kpi.metric) : undefined}
              className={`flex flex-col gap-1.5 sm:gap-2 ${
                drillable ? "transition-colors hover:bg-[var(--bg-card-hover)]" : ""
              } ${isOpen ? "ring-1 ring-[var(--accent-teal)]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <MetricTooltip metric={kpi.metric}>
                  <span className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide sm:tracking-wider">
                    {kpi.label}
                  </span>
                </MetricTooltip>
                {drillable && (
                  <svg
                    className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                )}
              </div>
              <span className="metric-value text-xl sm:text-2xl text-[var(--text-primary)]">
                {kpi.value}
              </span>
              <div className="flex items-center gap-2">
                {kpi.previous !== null && (
                  <DeltaPill current={kpi.current} previous={kpi.previous} />
                )}
              </div>
              {kpi.sparkData.length > 1 && (
                <div className="mt-1">
                  <SparkLine data={kpi.sparkData} />
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {expandedKpi && (
        <GlassCard className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-heading text-sm text-[var(--text-primary)]">
              {expandedKpi.label} — breakdown
            </h3>
            <button
              onClick={() => setExpanded(null)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              aria-label="Close breakdown"
            >
              ✕
            </button>
          </div>
          <KPIDrilldown metric={expandedKpi.metric} data={data} formatValue={formatValue} />
        </GlassCard>
      )}
    </div>
  );
}
