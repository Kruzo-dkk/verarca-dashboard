"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useCSContext } from "./CSProvider";

export function SupportMetrics() {
  const { data } = useCSContext();
  if (!data) return null;

  const { supportMetrics } = data;

  const trend = supportMetrics.ticketTrend;
  const trendPositive = trend !== null && trend <= 0; // decreasing tickets is good

  const cards = [
    {
      label: "Open Tickets",
      value: supportMetrics.openTickets.toString(),
      alert: supportMetrics.openTickets > 5,
    },
    {
      label: "Avg Resolution",
      value:
        supportMetrics.avgResolutionHours !== null
          ? `${supportMetrics.avgResolutionHours.toFixed(1)}h`
          : "N/A",
      alert: false,
    },
    {
      label: "Tickets This Month",
      value: supportMetrics.ticketsThisMonth.toString(),
      alert: false,
    },
    {
      label: "Trend vs Last Month",
      value: trend === null ? "N/A" : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`,
      alert: trend !== null && !trendPositive,
      positive: trendPositive,
    },
  ];

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Support Metrics</h2>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg bg-[var(--bg-secondary)] p-3"
          >
            <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
            <p
              className={`metric-value text-xl mt-1 ${
                card.alert
                  ? "text-red-400"
                  : "positive" in card && card.positive
                    ? "text-emerald-400"
                    : ""
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
