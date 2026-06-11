"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import { formatDKK, formatDealAge, formatPercent01 } from "@/lib/sales-format";

export function EmployeeComparison() {
  const { data } = useSalesContext();
  if (!data) return null;

  const rows = [...data.employeeComparison].sort(
    (a, b) => b.openPipelineValue - a.openPipelineValue
  );

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Employee Comparison</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--bg-secondary)]">
              <th className="text-left py-2 pr-4 font-medium">Name</th>
              <th className="text-right py-2 px-2 font-medium">Open</th>
              <th className="text-right py-2 px-2 font-medium">Pipeline</th>
              <th className="text-right py-2 px-2 font-medium">Weighted</th>
              <th className="text-right py-2 px-2 font-medium">Avg age</th>
              <th className="text-right py-2 px-2 font-medium">Won</th>
              <th className="text-right py-2 px-2 font-medium">MRR closed</th>
              <th className="text-right py-2 px-2 font-medium">Win rate</th>
              <th className="text-right py-2 pl-2 font-medium">Activities</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.ownerId}
                className="border-b border-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/30 transition-colors"
              >
                <td className="py-1.5 pr-4 truncate max-w-[140px] text-[var(--text-primary)]">
                  {e.ownerName}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                  {e.openDealCount}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                  {formatDKK(e.openPipelineValue)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-muted)]">
                  {formatDKK(e.weightedPipeline)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-muted)]">
                  {formatDealAge(e.avgDealAgeDays)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                  {e.dealsWon}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-emerald-500">
                  {formatDKK(e.mrrClosed)}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-muted)]">
                  {formatPercent01(e.winRate)}
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-[var(--text-muted)]">
                  {e.totalActivities}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="py-6 text-center text-sm text-[var(--text-muted)]"
                >
                  No employee comparison data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
