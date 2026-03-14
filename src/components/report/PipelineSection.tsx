"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { PipelineFunnel } from "@/components/charts/PipelineFunnel";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { ReportData } from "@/lib/types/report";

interface PipelineSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function PipelineSection({ data, formatValue }: PipelineSectionProps) {
  const p = data.pipeline;

  const formatCloseDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Pipeline</h2>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mb-4">
        <GlassCard className="text-center">
          <MetricTooltip metric="pipelineValue">
            <span className="text-xs text-[var(--text-muted)]">Pipeline Value</span>
          </MetricTooltip>
          <div className="metric-value text-xl mt-1">{formatValue(p.totalPipelineValue)}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="weightedPipeline">
            <span className="text-xs text-[var(--text-muted)]">Weighted</span>
          </MetricTooltip>
          <div className="metric-value text-xl mt-1">{formatValue(p.weightedPipeline)}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="winRate">
            <span className="text-xs text-[var(--text-muted)]">Win Rate</span>
          </MetricTooltip>
          <div className="metric-value text-xl mt-1">
            {p.winRate !== null ? `${p.winRate.toFixed(0)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="pipelineCoverage">
            <span className="text-xs text-[var(--text-muted)]">Pipeline Coverage</span>
          </MetricTooltip>
          <div className={`metric-value text-xl mt-1 ${
            p.pipelineCoverage !== null && p.pipelineCoverage >= 3
              ? "text-emerald-600"
              : p.pipelineCoverage !== null
                ? "text-amber-600"
                : ""
          }`}>
            {p.pipelineCoverage !== null ? `${p.pipelineCoverage.toFixed(1)}x` : "—"}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Deal Funnel</h3>
          <PipelineFunnel
            dealsOpen={p.dealsOpen}
            dealsWon={p.dealsWon}
            dealsLost={p.dealsLost}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <MetricTooltip metric="avgDealSize">
                <span className="text-[var(--text-muted)] text-xs">Avg Deal Size</span>
              </MetricTooltip>
              <div className="metric-value">{formatValue(p.avgDealSize)}</div>
            </div>
            <div>
              <MetricTooltip metric="avgSalesCycle">
                <span className="text-[var(--text-muted)] text-xs">Avg Sales Cycle</span>
              </MetricTooltip>
              <div className="metric-value">{p.avgSalesCycleDays} days</div>
            </div>
          </div>
        </GlassCard>

        {/* Deals table */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Deals</h3>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "40%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
                  <th className="pb-2 font-medium">Deal</th>
                  <th className="pb-2 font-medium text-right pr-3">Amount</th>
                  <th className="pb-2 font-medium hidden sm:table-cell pl-3">Stage</th>
                  <th className="pb-2 font-medium">Close</th>
                  <th className="pb-2 font-medium text-right">Prob.</th>
                </tr>
              </thead>
              <tbody>
                {p.deals.map((deal) => (
                  <tr key={deal.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-1.5 text-[var(--text-primary)] truncate">
                      <div className="truncate">{deal.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] sm:hidden truncate">{deal.stage}</div>
                    </td>
                    <td className="py-1.5 text-right metric-value pr-3 tabular-nums">{formatValue(deal.amount)}</td>
                    <td className="py-1.5 text-[var(--text-secondary)] hidden sm:table-cell pl-3 truncate">{deal.stage}</td>
                    <td className="py-1.5 text-[var(--text-secondary)] text-xs">{formatCloseDate(deal.closeDate)}</td>
                    <td className="py-1.5 text-right metric-value tabular-nums">{(deal.probability * 100).toFixed(0)}%</td>
                  </tr>
                ))}
                {p.deals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">No deals</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
