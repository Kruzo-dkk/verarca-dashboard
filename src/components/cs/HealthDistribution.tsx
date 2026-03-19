"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCSContext } from "./CSProvider";

export function HealthDistribution() {
  const { data } = useCSContext();
  if (!data) return null;

  const { healthDistribution } = data;
  const total =
    healthDistribution.healthy +
    healthDistribution.neutral +
    healthDistribution.atRisk;

  if (total === 0) return null;

  const segments = [
    {
      label: "Healthy",
      count: healthDistribution.healthy,
      pct: ((healthDistribution.healthy / total) * 100).toFixed(1),
      color: "bg-emerald-500",
      text: "text-emerald-400",
    },
    {
      label: "Neutral",
      count: healthDistribution.neutral,
      pct: ((healthDistribution.neutral / total) * 100).toFixed(1),
      color: "bg-amber-500",
      text: "text-amber-400",
    },
    {
      label: "At Risk",
      count: healthDistribution.atRisk,
      pct: ((healthDistribution.atRisk / total) * 100).toFixed(1),
      color: "bg-red-500",
      text: "text-red-400",
    },
  ];

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Health Distribution</h2>
      <p className="text-xs text-[var(--text-muted)] mb-3">
        {total} total customers
      </p>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${seg.pct}%` }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-full ${seg.color}`} />
              <span className="text-sm text-[var(--text-primary)]">{seg.label}</span>
            </div>
            <span className={`text-sm font-medium tabular-nums ${seg.text}`}>
              {seg.count} ({seg.pct}%)
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
