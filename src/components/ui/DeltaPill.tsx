"use client";

interface DeltaPillProps {
  current: number;
  previous: number | null;
  // "percent": relative % change. "points": absolute difference in pp (for
  // metrics that are themselves percentages, like NRR). "value": raw difference.
  format?: "percent" | "value" | "points";
  invert?: boolean; // true = lower is better (e.g., churn)
}

export function DeltaPill({ current, previous, format = "percent", invert = false }: DeltaPillProps) {
  if (previous === null || previous === 0) {
    return <span className="text-xs text-[var(--text-muted)]">&mdash;</span>;
  }

  const diff = current - previous;
  // Direction is driven by the raw difference for "points"/"value" (a percentage
  // metric can move while its base is tiny), and by relative change otherwise.
  const delta = format === "percent" ? (diff / Math.abs(previous)) * 100 : diff;
  const isPositive = invert ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;

  const colorClass = isNeutral
    ? "bg-slate-100 text-slate-500"
    : isPositive
      ? "bg-emerald-50 text-emerald-600"
      : "bg-red-50 text-red-600";

  const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "";

  const displayValue =
    format === "percent"
      ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`
      : format === "points"
        ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp`
        : `${diff >= 0 ? "+" : ""}${Math.round(diff)}`;

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {displayValue} {arrow}
    </span>
  );
}
