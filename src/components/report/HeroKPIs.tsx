"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { SparkLine } from "@/components/charts/SparkLine";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricKey } from "@/lib/tooltip-registry";
import type { ReportData } from "@/lib/types/report";

interface HeroKPIsProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function HeroKPIs({ data, formatValue }: HeroKPIsProps) {
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

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <GlassCard key={kpi.label} className="flex flex-col gap-2">
          <MetricTooltip metric={kpi.metric}>
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
              {kpi.label}
            </span>
          </MetricTooltip>
          <span className="metric-value text-2xl text-[var(--text-primary)]">
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
      ))}
    </div>
  );
}
