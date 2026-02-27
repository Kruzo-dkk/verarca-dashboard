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
  const trendColor = isPositive ? "text-emerald-400" : "text-red-400";
  const trendArrow = isPositive ? "\u2191" : "\u2193";

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 flex flex-col gap-2">
      <span className="text-sm text-zinc-400 font-medium">{label}</span>
      <div className="flex items-baseline gap-2">
        {prefix && <span className="text-zinc-500 text-lg">{prefix}</span>}
        <span className="text-3xl font-bold text-white tracking-tight">
          {value}
        </span>
        {suffix && <span className="text-zinc-500 text-lg">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <span className={`text-sm font-medium ${trendColor}`}>
          {trendArrow} {Math.abs(trend).toFixed(1)}%
        </span>
      )}
    </div>
  );
}
