"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import type { DealOutcome } from "@/lib/types/sales";

function formatDKK(ore: number): string {
  const kr = ore / 100;
  return `kr ${kr.toLocaleString("da-DK", { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

function DealRow({
  deal,
  variant,
}: {
  deal: DealOutcome;
  variant: "win" | "loss";
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--bg-secondary)]/50 last:border-0">
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-sm truncate text-[var(--text-primary)]">
          {deal.name}
        </p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {deal.ownerName ?? "Unassigned"} &middot; {formatDate(deal.closeDate)}
        </p>
      </div>
      <span
        className={`text-sm tabular-nums font-medium whitespace-nowrap ${
          variant === "win" ? "text-emerald-500" : "text-red-500"
        }`}
      >
        {formatDKK(deal.amount)}
      </span>
    </div>
  );
}

export function RecentOutcomes() {
  const { data } = useSalesContext();
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Recent Wins */}
      <GlassCard>
        <h2 className="section-heading mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />
          Recent Wins
        </h2>
        {data.recentWins.length > 0 ? (
          <div>
            {data.recentWins.slice(0, 5).map((deal) => (
              <DealRow key={deal.id} deal={deal} variant="win" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            No recent wins
          </p>
        )}
      </GlassCard>

      {/* Recent Losses */}
      <GlassCard>
        <h2 className="section-heading mb-3">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2" />
          Recent Losses
        </h2>
        {data.recentLosses.length > 0 ? (
          <div>
            {data.recentLosses.slice(0, 5).map((deal) => (
              <DealRow key={deal.id} deal={deal} variant="loss" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] py-4 text-center">
            No recent losses
          </p>
        )}
      </GlassCard>
    </div>
  );
}
