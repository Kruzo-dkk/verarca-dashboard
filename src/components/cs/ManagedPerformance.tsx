"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCSContext } from "./CSProvider";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

function formatPct(value: number | null): string {
  if (value === null) return "N/A";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function ManagedPerformance() {
  const { data } = useCSContext();
  if (!data) return null;

  const p = data.managedPerformance;

  const metrics = [
    {
      label: "Avg MRR",
      managed: formatDKK(p.managedAvgMRR),
      standard: formatDKK(p.standardAvgMRR),
      managedWins: p.managedAvgMRR > p.standardAvgMRR,
    },
    {
      label: "Growth Rate",
      managed: formatPct(p.managedGrowthRate),
      standard: formatPct(p.standardGrowthRate),
      managedWins:
        p.managedGrowthRate !== null &&
        p.standardGrowthRate !== null &&
        p.managedGrowthRate > p.standardGrowthRate,
    },
    {
      label: "Retention Rate",
      managed: formatPct(p.managedRetentionRate),
      standard: formatPct(p.standardRetentionRate),
      managedWins:
        p.managedRetentionRate !== null &&
        p.standardRetentionRate !== null &&
        p.managedRetentionRate > p.standardRetentionRate,
    },
  ];

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Managed vs Standard</h2>
      <div className="grid grid-cols-2 gap-4">
        {/* Column headers */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">
            Managed
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-teal)]">
            Standard
          </p>
        </div>

        {/* Metric rows */}
        {metrics.map((m) => (
          <>
            <div
              key={`managed-${m.label}`}
              className={`rounded-lg p-3 text-center ${
                m.managedWins
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-[var(--bg-secondary)]"
              }`}
            >
              <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
              <p className="metric-value text-lg mt-1">{m.managed}</p>
            </div>
            <div
              key={`standard-${m.label}`}
              className={`rounded-lg p-3 text-center ${
                !m.managedWins
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-[var(--bg-secondary)]"
              }`}
            >
              <p className="text-xs text-[var(--text-muted)]">{m.label}</p>
              <p className="metric-value text-lg mt-1">{m.standard}</p>
            </div>
          </>
        ))}
      </div>
    </GlassCard>
  );
}
