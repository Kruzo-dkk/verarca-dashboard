"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { MRRWaterfall } from "@/components/charts/MRRWaterfall";
import { ARRTrend } from "@/components/charts/ARRTrend";
import type { ReportData } from "@/lib/types/report";

interface RevenueSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function RevenueSection({ data, formatValue }: RevenueSectionProps) {
  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Revenue</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">MRR Waterfall</h3>
          <MRRWaterfall decomposition={data.revenue.decomposition} formatValue={formatValue} />
        </GlassCard>
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">ARR Trend (24M)</h3>
          <ARRTrend data={data.revenue.arrHistory} formatValue={formatValue} />
        </GlassCard>
      </div>

      {/* Growth indicators */}
      <div className="grid grid-cols-2 gap-4 mt-4 lg:grid-cols-4">
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">MoM Growth</span>
          <div className="metric-value text-lg mt-1">
            {data.revenue.growthMoM !== null ? `${data.revenue.growthMoM.toFixed(1)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">YoY Growth</span>
          <div className="metric-value text-lg mt-1">
            {data.revenue.growthYoY !== null ? `${data.revenue.growthYoY.toFixed(1)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Non-Recurring</span>
          <div className="metric-value text-lg mt-1">
            {formatValue(data.revenue.nonRecurringRevenue)}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Net New MRR</span>
          <div className={`metric-value text-lg mt-1 ${data.revenue.netNewMRR >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatValue(data.revenue.netNewMRR)}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
