"use client";

interface DeltaPillProps {
  current: number;
  previous: number | null;
  format?: "percent" | "value";
  invert?: boolean; // true = lower is better (e.g., churn)
}

export function DeltaPill({ current, previous, format = "percent", invert = false }: DeltaPillProps) {
  if (previous === null || previous === 0) {
    return <span className="text-xs text-[var(--text-muted)]">&mdash;</span>;
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = invert ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  const colorClass = isNeutral
    ? "bg-slate-800 text-slate-400"
    : isPositive
      ? "bg-emerald-950/60 text-emerald-400"
      : "bg-red-950/60 text-red-400";

  const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "";

  const displayValue = format === "percent"
    ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`
    : `${delta >= 0 ? "+" : ""}${Math.round(current - previous)}`;

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {displayValue} {arrow}
    </span>
  );
}
