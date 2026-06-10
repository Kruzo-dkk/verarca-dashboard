"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  muted = false,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** No target set — render a neutral gray ring instead of a failing red one. */
  muted?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(progress, 100) / 100) * circumference;
  const color = muted
    ? "#9ca3af"
    : progress >= 80
      ? "#10b981"
      : progress >= 50
        ? "#f59e0b"
        : "#ef4444";

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-[var(--bg-secondary)]"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

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

  const ringSize = tvMode ? 120 : 80;
  const ringStroke = tvMode ? 8 : 6;

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
          const targetStr =
            item.format === "dkk"
              ? formatDKK(item.target)
              : item.target.toLocaleString("da-DK");

          return (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 py-2"
            >
              <div className="relative">
                <ProgressRing
                  progress={progress}
                  size={ringSize}
                  strokeWidth={ringStroke}
                  muted={!hasTarget}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className={`font-semibold tabular-nums ${
                      tvMode ? "text-lg" : "text-sm"
                    } ${
                      !hasTarget
                        ? "text-[var(--text-muted)]"
                        : progress >= 80
                          ? "text-emerald-500"
                          : progress >= 50
                            ? "text-amber-500"
                            : "text-red-500"
                    }`}
                  >
                    {hasTarget ? `${progress}%` : "—"}
                  </span>
                </div>
              </div>
              <span
                className={`font-medium text-[var(--text-primary)] ${
                  tvMode ? "text-base" : "text-xs"
                }`}
              >
                {item.label}
              </span>
              <span
                className={`text-[var(--text-muted)] tabular-nums ${
                  tvMode ? "text-sm" : "text-[11px]"
                }`}
              >
                {actualStr} / {hasTarget ? targetStr : "ingen mål"}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
