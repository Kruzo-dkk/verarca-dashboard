"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useSalesContext } from "./SalesProvider";
import type { ActivityCounts } from "@/lib/types/sales";

function ActivityCard({
  label,
  counts,
}: {
  label: string;
  counts: ActivityCounts;
}) {
  return (
    <div className="rounded-lg bg-[var(--bg-secondary)]/50 p-3">
      <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
        {label}
      </span>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="metric-value text-lg tabular-nums text-[var(--text-primary)]">
            {counts.calls}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">Calls</p>
        </div>
        <div>
          <p className="metric-value text-lg tabular-nums text-[var(--text-primary)]">
            {counts.meetings}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">Meetings</p>
        </div>
        <div>
          <p className="metric-value text-lg tabular-nums text-[var(--text-primary)]">
            {counts.emails}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">Emails</p>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { data } = useSalesContext();
  if (!data) return null;

  const { activities } = data;

  return (
    <GlassCard>
      <h2 className="section-heading mb-4">Activity</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <ActivityCard label="Today" counts={activities.today} />
        <ActivityCard label="This Week" counts={activities.thisWeek} />
        <ActivityCard label="This Month" counts={activities.thisMonth} />
      </div>

      {/* Per-rep breakdown */}
      {activities.byOwner.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--bg-secondary)]">
                <th className="text-left py-2 pr-4 font-medium">Rep</th>
                <th className="text-right py-2 px-2 font-medium">Calls</th>
                <th className="text-right py-2 px-2 font-medium">Meetings</th>
                <th className="text-right py-2 pl-2 font-medium">Emails</th>
              </tr>
            </thead>
            <tbody>
              {activities.byOwner.map((owner) => (
                <tr
                  key={owner.ownerId}
                  className="border-b border-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)]/30 transition-colors"
                >
                  <td className="py-1.5 pr-4 truncate max-w-[140px] text-[var(--text-primary)]">
                    {owner.ownerName}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                    {owner.thisMonth.calls}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-[var(--text-primary)]">
                    {owner.thisMonth.meetings}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-[var(--text-primary)]">
                    {owner.thisMonth.emails}
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
