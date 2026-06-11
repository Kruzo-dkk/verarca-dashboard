"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import {
  formatDKK,
  formatDate,
  formatDealAge,
  formatPercent01,
} from "@/lib/sales-format";
import type { SalesDeal, StageGroup } from "@/lib/types/sales";

export function PipelineBoard() {
  const { data } = useSalesContext();
  if (!data) return null;

  const { pipeline } = data;
  const sortedStages = [...pipeline.stages].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return (
    <div className="space-y-4">
      <h2 className="section-heading">Pipeline</h2>

      {sortedStages.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedStages.map((stage) => (
            <StagePane key={stage.stageId} stage={stage} />
          ))}
        </div>
      ) : (
        <GlassCard>
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            No open deals in the pipeline
          </p>
        </GlassCard>
      )}

      {/* Footer totals — full width, preserves the old tfoot semantics */}
      <GlassCard className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-[var(--text-primary)]">
          Total ({pipeline.dealCount} deals)
        </span>
        <div className="flex items-center gap-4 tabular-nums">
          <span className="text-[var(--text-primary)] font-medium">
            {formatDKK(pipeline.totalValue)}
          </span>
          <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            weighted
          </span>
          <span className="text-[var(--text-primary)] font-medium">
            {formatDKK(pipeline.weightedValue)}
          </span>
        </div>
      </GlassCard>
    </div>
  );
}

function StagePane({ stage }: { stage: StageGroup }) {
  const sortedDeals = [...stage.deals].sort((a, b) => b.amount - a.amount);

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
          {stage.label}
        </h3>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
          {stage.deals.length} deals &middot; {formatDKK(stage.totalValue)}
        </span>
      </div>

      {sortedDeals.length > 0 ? (
        <div className="flex flex-col divide-y divide-[var(--bg-secondary)]/50 max-h-[22rem] overflow-y-auto">
          {sortedDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)] py-4 text-center">
          No deals
        </p>
      )}
    </GlassCard>
  );
}

function DealCard({ deal }: { deal: SalesDeal }) {
  return (
    <div className="py-2 hover:bg-[var(--bg-secondary)]/30 transition-colors">
      {/* Primary line: name + amount */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-[var(--text-primary)]">
          {deal.name}
        </span>
        <span className="tabular-nums text-sm font-medium text-[var(--text-primary)] whitespace-nowrap">
          {formatDKK(deal.amount)}
        </span>
      </div>

      {/* Secondary line: owner · created · age · probability */}
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <span className="text-[11px] text-[var(--text-muted)] truncate">
          {deal.ownerName ?? "Unassigned"} &middot; oprettet{" "}
          {formatDate(deal.createdDate)} &middot; {formatDealAge(deal.ageDays)}
        </span>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
          {formatPercent01(deal.probability)}
        </span>
      </div>

      {/* Tertiary line: close date + last update (subtle) */}
      <div className="flex items-center justify-between gap-2 mt-0.5 text-[10px] text-[var(--text-muted)]/70">
        <span>lukker {formatDate(deal.closeDate)}</span>
        <span className="whitespace-nowrap">
          opdateret {formatDate(deal.updatedDate)}
        </span>
      </div>
    </div>
  );
}
