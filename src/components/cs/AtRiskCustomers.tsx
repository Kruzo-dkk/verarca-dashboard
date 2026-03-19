"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCSContext } from "./CSProvider";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

const trendArrow: Record<string, string> = {
  expanding: "\u2191",
  flat: "\u2192",
  contracting: "\u2193",
};

const trendColor: Record<string, string> = {
  expanding: "text-emerald-400",
  flat: "text-[var(--text-muted)]",
  contracting: "text-red-400",
};

export function AtRiskCustomers() {
  const { data } = useCSContext();
  if (!data) return null;

  const customers = [...data.atRiskCustomers].sort(
    (a, b) => a.healthScore - b.healthScore,
  );

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">At-Risk Customers</h2>

      {customers.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No at-risk customers — looking healthy! 🎉
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">MRR</th>
                <th className="pb-2 pr-4">Health</th>
                <th className="pb-2 pr-4">Tier</th>
                <th className="pb-2 pr-4">Trend</th>
                <th className="pb-2">Risk Factors</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--border-subtle)] last:border-0"
                >
                  <td className="py-2 pr-4 text-[var(--text-primary)] font-medium">
                    {c.name}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--text-primary)]">
                    {formatDKK(c.mrr)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                      {c.healthScore}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {c.tier ?? "—"}
                  </td>
                  <td className={`py-2 pr-4 ${trendColor[c.mrrTrend]}`}>
                    {trendArrow[c.mrrTrend]} {c.mrrTrend}
                  </td>
                  <td className="py-2 text-xs text-[var(--text-muted)]">
                    {c.healthFactors.length > 0
                      ? c.healthFactors.join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
