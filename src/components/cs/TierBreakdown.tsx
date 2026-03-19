"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCSContext } from "./CSProvider";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

const tierConfig = {
  managed: { label: "Managed", color: "purple" },
  standard: { label: "Standard", color: "teal" },
  unassigned: { label: "Unassigned", color: "gray" },
} as const;

export function TierBreakdown() {
  const { data } = useCSContext();
  if (!data) return null;

  const { tierBreakdown } = data;
  const tiers = [
    { key: "managed" as const, stats: tierBreakdown.managed },
    { key: "standard" as const, stats: tierBreakdown.standard },
    { key: "unassigned" as const, stats: tierBreakdown.unassigned },
  ];

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Service Tiers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiers.map(({ key, stats }) => {
          const cfg = tierConfig[key];
          const borderColor =
            cfg.color === "purple"
              ? "border-purple-500/40"
              : cfg.color === "teal"
                ? "border-[var(--accent-teal)]/40"
                : "border-[var(--border-subtle)]";
          const accentText =
            cfg.color === "purple"
              ? "text-purple-400"
              : cfg.color === "teal"
                ? "text-[var(--accent-teal)]"
                : "text-[var(--text-muted)]";

          return (
            <div
              key={key}
              className={`rounded-lg border ${borderColor} bg-[var(--bg-secondary)] p-4`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${accentText}`}>
                {cfg.label}
              </p>
              <p className="metric-value text-2xl mt-1">{stats.count}</p>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {formatDKK(stats.mrr)} MRR
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {stats.percentOfTotal.toFixed(1)}% of total
              </p>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
