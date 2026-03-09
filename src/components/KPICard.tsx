"use client";

interface KPICardProps {
  label: string;
  value: string;
  trend?: number;
  prefix?: string;
  suffix?: string;
}

export function KPICard({ label, value, trend, prefix, suffix }: KPICardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  const trendColor = isPositive ? "text-emerald-600" : "text-red-600";
  const trendArrow = isPositive ? "\u2191" : "\u2193";

  return (
    <div className="glass-card p-6 flex flex-col gap-2">
      <span className="text-sm text-[var(--text-muted)] font-medium">{label}</span>
      <div className="flex items-baseline gap-2">
        {prefix && <span className="text-[var(--text-muted)] text-lg">{prefix}</span>}
        <span className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          {value}
        </span>
        {suffix && <span className="text-[var(--text-muted)] text-lg">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <span className={`text-sm font-medium ${trendColor}`}>
          {trendArrow} {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
