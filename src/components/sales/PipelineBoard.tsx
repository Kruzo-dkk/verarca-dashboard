"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

export function PipelineBoard() {
  const { data } = useSalesContext();
  if (!data) return null;

  const { pipeline } = data;
  const sortedStages = [...pipeline.stages].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Pipeline</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--bg-secondary)]">
              <th className="text-left py-2 pr-4 font-medium">Deal</th>
              <th className="text-right py-2 px-2 font-medium">Amount</th>
              <th className="text-right py-2 px-2 font-medium">Close Date</th>
              <th className="text-right py-2 pl-2 font-medium">Prob.</th>
            </tr>
          </thead>
          <tbody>
            {sortedStages.map((stage) => {
              const sortedDeals = [...stage.deals].sort(
                (a, b) => b.amount - a.amount
              );
              return (
                <StageSection key={stage.stageId} stage={stage}>
                  {sortedDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/30 transition-colors"
                    >
                      <td className="py-1.5 pr-4">
                        <span className="truncate block max-w-[200px] text-[var(--text-primary)]">
                          {deal.name}
                        </span>
                        {deal.ownerName && (
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {deal.ownerName}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                        {formatDKK(deal.amount)}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-muted)]">
                        {formatDate(deal.closeDate)}
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-[var(--text-muted)]">
                        {Math.round(deal.probability * 100)}%
                      </td>
                    </tr>
                  ))}
                </StageSection>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--bg-secondary)] font-medium text-[var(--text-primary)]">
              <td className="py-2 pr-4">
                Total ({pipeline.dealCount} deals)
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {formatDKK(pipeline.totalValue)}
              </td>
              <td className="py-2 px-2 text-right text-[11px] text-[var(--text-muted)]">
                weighted
              </td>
              <td className="py-2 pl-2 text-right tabular-nums">
                {formatDKK(pipeline.weightedValue)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassCard>
  );
}

function StageSection({
  stage,
  children,
}: {
  stage: { stageId: string; label: string; totalValue: number; deals: { id: string }[] };
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="bg-[var(--bg-secondary)]/40">
        <td
          colSpan={4}
          className="py-2 px-1 font-medium text-xs text-[var(--text-primary)]"
        >
          <div className="flex items-center justify-between">
            <span>{stage.label}</span>
            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
              {stage.deals.length} deals &middot; {formatDKK(stage.totalValue)}
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
