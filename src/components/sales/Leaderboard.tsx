"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import { formatDKK } from "@/lib/sales-format";

const RANK_BADGES = ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"];

export function Leaderboard() {
  const { data } = useSalesContext();
  if (!data) return null;

  const sorted = [...data.leaderboard].sort(
    (a, b) => b.mrrClosed - a.mrrClosed
  );

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Leaderboard</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--bg-secondary)]">
              <th className="text-left py-2 pr-2 font-medium w-8">#</th>
              <th className="text-left py-2 pr-4 font-medium">Name</th>
              <th className="text-right py-2 px-2 font-medium">Deals</th>
              <th className="text-right py-2 px-2 font-medium">MRR Closed</th>
              <th className="text-right py-2 pl-2 font-medium">Activities</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => {
              const rank = idx + 1;
              const badge = RANK_BADGES[rank] ?? "";

              return (
                <tr
                  key={entry.ownerId}
                  className={`border-b border-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/30 transition-colors ${
                    rank <= 3 ? "font-medium" : ""
                  }`}
                >
                  <td className="py-1.5 pr-2 text-[var(--text-muted)]">
                    {badge || rank}
                  </td>
                  <td className="py-1.5 pr-4 truncate max-w-[140px] text-[var(--text-primary)]">
                    {entry.ownerName}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                    {entry.dealsWon}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-emerald-500">
                    {formatDKK(entry.mrrClosed)}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-[var(--text-muted)]">
                    {entry.totalActivities}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-6 text-center text-sm text-[var(--text-muted)]"
                >
                  No leaderboard data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
