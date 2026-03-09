"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { MRRWaterfall } from "@/components/charts/MRRWaterfall";
import { ARRTrend } from "@/components/charts/ARRTrend";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { ReportData } from "@/lib/types/report";

interface RevenueSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function RevenueSection({ data, formatValue }: RevenueSectionProps) {
  const committed = data.revenue.committedMRR;

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

      {/* Committed MRR — only shows when discount data is available */}
      {committed && committed.discountCount > 0 && (
        <div className="mt-4">
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--text-muted)]">
                <MetricTooltip metric="billedMRR">
                  Committed MRR
                </MetricTooltip>
              </h3>
              <span className="text-[10px] text-[var(--text-muted)]">
                {committed.discountCount} active discount{committed.discountCount !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* List Price MRR */}
              <div>
                <MetricTooltip metric="mrr">
                  <p className="text-xs text-[var(--text-muted)]">List Price MRR</p>
                </MetricTooltip>
                <p className="text-xl font-bold metric-value text-[var(--text-primary)] mt-1">
                  {formatValue(committed.listPriceMRR)}
                </p>
              </div>

              {/* Billed MRR */}
              <div>
                <MetricTooltip metric="billedMRR">
                  <p className="text-xs text-[var(--text-muted)]">Billed MRR</p>
                </MetricTooltip>
                <p className="text-xl font-bold metric-value text-[var(--text-primary)] mt-1">
                  {formatValue(committed.billedMRR)}
                </p>
              </div>

              {/* Discount Delta */}
              <div>
                <MetricTooltip metric="discountDelta">
                  <p className="text-xs text-[var(--text-muted)]">Discount Delta</p>
                </MetricTooltip>
                <p className="text-xl font-bold metric-value text-amber-600 mt-1">
                  −{formatValue(committed.totalDiscountImpact)}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  {committed.listPriceMRR > 0
                    ? `${((committed.totalDiscountImpact / committed.listPriceMRR) * 100).toFixed(1)}% of list price`
                    : ""}
                </p>
              </div>
            </div>

            {/* MRR vs Billed visual bar */}
            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] mb-1.5">
                <span>Billed</span>
                <span className="ml-auto">List Price</span>
              </div>
              <div className="relative h-3 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                {/* Billed portion */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-teal)]"
                  style={{
                    width: committed.listPriceMRR > 0
                      ? `${(committed.billedMRR / committed.listPriceMRR) * 100}%`
                      : "0%",
                  }}
                />
                {/* Discount gap (amber) */}
                <div
                  className="absolute inset-y-0 rounded-full bg-amber-400/40"
                  style={{
                    left: committed.listPriceMRR > 0
                      ? `${(committed.billedMRR / committed.listPriceMRR) * 100}%`
                      : "0%",
                    right: "0%",
                  }}
                />
              </div>
            </div>

            {/* Upcoming discount expirations */}
            {committed.upcomingExpirations.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                <MetricTooltip metric="discountExpirations">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
                    Upcoming Discount Expirations
                  </p>
                </MetricTooltip>
                <div className="space-y-1.5">
                  {committed.upcomingExpirations.slice(0, 6).map((exp) => (
                    <div
                      key={exp.month}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-[var(--text-secondary)]">
                        {formatExpirationMonth(exp.month)}
                      </span>
                      <span className="text-emerald-600 font-medium metric-value">
                        +{formatValue(exp.upliftAmount)}
                        <span className="text-[10px] text-[var(--text-muted)] ml-1">
                          ({exp.discountCount} discount{exp.discountCount !== 1 ? "s" : ""})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Growth indicators */}
      <div className="grid grid-cols-2 gap-4 mt-4 lg:grid-cols-4">
        <GlassCard className="text-center">
          <MetricTooltip metric="momGrowth">
            <span className="text-xs text-[var(--text-muted)]">MoM Growth</span>
          </MetricTooltip>
          <div className="metric-value text-lg mt-1">
            {data.revenue.growthMoM !== null ? `${data.revenue.growthMoM.toFixed(1)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="yoyGrowth">
            <span className="text-xs text-[var(--text-muted)]">YoY Growth</span>
          </MetricTooltip>
          <div className="metric-value text-lg mt-1">
            {data.revenue.growthYoY !== null ? `${data.revenue.growthYoY.toFixed(1)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="nonRecurring">
            <span className="text-xs text-[var(--text-muted)]">Non-Recurring</span>
          </MetricTooltip>
          <div className="metric-value text-lg mt-1">
            {formatValue(data.revenue.nonRecurringRevenue)}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="netNewMRR">
            <span className="text-xs text-[var(--text-muted)]">Net New MRR</span>
          </MetricTooltip>
          <div className={`metric-value text-lg mt-1 ${data.revenue.netNewMRR >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatValue(data.revenue.netNewMRR)}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}

/** Format YYYY-MM to readable month string */
function formatExpirationMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
