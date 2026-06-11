"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import { formatDKK } from "@/lib/sales-format";

interface TargetItem {
  label: string;
  actual: number;
  target: number;
  format: "dkk" | "number";
}

export function TargetProgress() {
  const { data, tvMode } = useSalesContext();
  if (!data) return null;

  const { targets } = data;

  const items: TargetItem[] = [
    {
      label: "New MRR",
      actual: targets.actualNewMRR,
      target: targets.targetNewMRR,
      format: "dkk",
    },
    {
      label: "New Logos",
      actual: targets.actualNewLogos,
      target: targets.targetNewLogos,
      format: "number",
    },
    {
      label: "Pipeline",
      actual: targets.actualPipeline,
      target: targets.targetPipeline,
      format: "dkk",
    },
    {
      label: "Meetings",
      actual: targets.actualMeetings,
      target: targets.targetMeetings,
      format: "number",
    },
    {
      label: "Calls",
      actual: targets.actualCalls,
      target: targets.targetCalls,
      format: "number",
    },
  ];

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Monthly Targets</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((item) => {
          const hasTarget = item.target > 0;
          const progress = hasTarget
            ? Math.round((item.actual / item.target) * 100)
            : 0;
          const actualStr =
            item.format === "dkk"
              ? formatDKK(item.actual)
              : item.actual.toLocaleString("da-DK");

          // The bar/percent is the secondary cue, so colour stays subtle but
          // still signals attainment: green ≥80%, amber ≥50%, else red.
          const barColor =
            progress >= 80 ? "#10b981" : progress >= 50 ? "#f59e0b" : "#ef4444";
          const pctClass =
            progress >= 80
              ? "text-emerald-500"
              : progress >= 50
                ? "text-amber-500"
                : "text-red-500";

          return (
            <div key={item.label} className="flex flex-col gap-1.5 py-1">
              {/* Label — quiet caption above the figure */}
              <span
                className={`text-[var(--text-muted)] ${
                  tvMode ? "text-sm" : "text-[11px]"
                }`}
              >
                {item.label}
              </span>

              {/* The number — the headline */}
              <span
                className={`font-semibold tabular-nums text-[var(--text-primary)] leading-tight ${
                  tvMode ? "text-3xl" : "text-lg sm:text-xl"
                }`}
              >
                {actualStr}
              </span>

              {/* Target attainment — the bi-ting: thin bar + small % */}
              {hasTarget ? (
                <div className="flex items-center gap-2">
                  <div
                    className={`flex-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden ${
                      tvMode ? "h-2" : "h-1.5"
                    }`}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(progress, 100)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                  <span
                    className={`tabular-nums shrink-0 ${pctClass} ${
                      tvMode ? "text-sm" : "text-[11px]"
                    }`}
                  >
                    {progress}%
                  </span>
                </div>
              ) : (
                <span
                  className={`text-[var(--text-muted)]/70 ${
                    tvMode ? "text-sm" : "text-[11px]"
                  }`}
                >
                  ingen mål
                </span>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
