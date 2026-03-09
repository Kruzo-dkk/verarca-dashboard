"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { PipelineFunnel } from "@/components/charts/PipelineFunnel";
import type { ReportData } from "@/lib/types/report";

interface PipelineSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function PipelineSection({ data, formatValue }: PipelineSectionProps) {
  const p = data.pipeline;

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Pipeline</h2>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Pipeline Value</span>
          <div className="metric-value text-xl mt-1">{formatValue(p.totalPipelineValue)}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Weighted</span>
          <div className="metric-value text-xl mt-1">{formatValue(p.weightedPipeline)}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Win Rate</span>
          <div className="metric-value text-xl mt-1">
            {p.winRate !== null ? `${p.winRate.toFixed(0)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Pipeline Coverage</span>
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
              <span className="text-[var(--text-muted)] text-xs">Avg Deal Size</span>
              <div className="metric-value">{formatValue(p.avgDealSize)}</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)] text-xs">Avg Sales Cycle</span>
              <div className="metric-value">{p.avgSalesCycleDays} days</div>
            </div>
          </div>
        </GlassCard>

        {/* Deals table */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Deals</h3>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">Deal</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium text-right">Prob.</th>
                </tr>
              </thead>
              <tbody>
                {p.deals.map((deal) => (
                  <tr key={deal.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-1.5 text-[var(--text-primary)] truncate max-w-[150px]">
                      {deal.name}
                    </td>
                    <td className="py-1.5 text-right metric-value">{formatValue(deal.amount)}</td>
                    <td className="py-1.5 text-[var(--text-secondary)]">{deal.stage}</td>
                    <td className="py-1.5 text-right metric-value">{(deal.probability * 100).toFixed(0)}%</td>
                  </tr>
                ))}
                {p.deals.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-[var(--text-muted)]">No deals</td>
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
