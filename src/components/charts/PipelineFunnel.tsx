"use client";

interface FunnelStage {
  label: string;
  count: number;
  color: string;
}

interface PipelineFunnelProps {
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
}

export function PipelineFunnel({ dealsOpen, dealsWon, dealsLost }: PipelineFunnelProps) {
  const total = dealsOpen + dealsWon + dealsLost;
  if (total === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No pipeline data</p>;
  }

  const stages: FunnelStage[] = [
    { label: "Open", count: dealsOpen, color: "bg-blue-500" },
    { label: "Won", count: dealsWon, color: "bg-emerald-500" },
    { label: "Lost", count: dealsLost, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const pct = total > 0 ? (stage.count / total) * 100 : 0;
        return (
          <div key={stage.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[var(--text-secondary)]">{stage.label}</span>
              <span className="metric-value text-[var(--text-primary)]">{stage.count}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div
                className={`h-full rounded-full ${stage.color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
