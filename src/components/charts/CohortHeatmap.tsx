"use client";

import type { CohortRow } from "@/lib/types/report";

interface CohortHeatmapProps {
  data: CohortRow[];
}

function getRetentionColor(pct: number): string {
  if (pct >= 95) return "bg-emerald-900/80 text-emerald-300";
  if (pct >= 85) return "bg-emerald-900/50 text-emerald-400";
  if (pct >= 70) return "bg-amber-900/50 text-amber-400";
  if (pct >= 50) return "bg-red-900/40 text-red-400";
  return "bg-red-900/60 text-red-300";
}

export function CohortHeatmap({ data }: CohortHeatmapProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        No cohort data available
      </p>
    );
  }

  // Get the max number of months across all cohorts
  const maxMonths = Math.max(...data.map((r) => r.retentionByMonth.length), 0);
  const monthHeaders = Array.from({ length: maxMonths }, (_, i) => `M${i}`);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left py-1 px-2 text-[var(--text-muted)] font-medium">Cohort</th>
            <th className="text-right py-1 px-2 text-[var(--text-muted)] font-medium">Size</th>
            {monthHeaders.map((h) => (
              <th key={h} className="text-center py-1 px-2 text-[var(--text-muted)] font-medium min-w-[44px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.cohortMonth}>
              <td className="py-1 px-2 text-[var(--text-secondary)] whitespace-nowrap">
                {formatCohortMonth(row.cohortMonth)}
              </td>
              <td className="py-1 px-2 text-right metric-value text-[var(--text-secondary)]">
                {row.startCount}
              </td>
              {row.retentionByMonth.map((rm, i) => (
                <td
                  key={i}
                  className={`py-1 px-2 text-center rounded-sm ${getRetentionColor(rm.retainedPercent)}`}
                >
                  <span className="metric-value">{rm.retainedPercent.toFixed(0)}%</span>
                </td>
              ))}
              {/* Fill empty cells if this cohort has fewer months */}
              {Array.from({ length: maxMonths - row.retentionByMonth.length }, (_, i) => (
                <td key={`empty-${i}`} className="py-1 px-2" />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCohortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
