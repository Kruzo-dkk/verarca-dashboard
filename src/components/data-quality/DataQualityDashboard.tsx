"use client";

import { useDataQuality } from "./DataQualityProvider";
import { useReportContext } from "@/components/providers/ReportProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import type { AnomalyItem, ExclusionItem } from "@/lib/types/data-quality";

// ─── Status badge ────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pass: "bg-emerald-500/20 text-emerald-400",
    warn: "bg-amber-500/20 text-amber-400",
    fail: "bg-red-500/20 text-red-400",
    no_data: "bg-zinc-500/20 text-zinc-400",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? colors.no_data}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

// ─── Loading skeleton ────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">
        Data Quality
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <GlassCard key={i}>
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-white/10 rounded w-1/3" />
              <div className="h-8 bg-white/10 rounded w-2/3" />
              <div className="h-4 bg-white/10 rounded w-full" />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Reconciliation card ─────────────────────────────────────

function ReconciliationCard() {
  const { data } = useDataQuality();
  const { formatValue } = useReportContext();
  if (!data) return null;

  const { reconciliation: r } = data;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          MRR Reconciliation
        </h2>
        <StatusBadge status={r.status} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Monthly Snapshot</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {formatValue(r.snapshotMRR)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Customer Sum</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {formatValue(r.sumCustomerMRR)}
          </p>
        </div>
      </div>

      {r.delta > 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Delta: {formatValue(r.delta)}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Frisbii comparison card ─────────────────────────────────

function FrisbiiComparisonCard() {
  const { data } = useDataQuality();
  if (!data) return null;

  const { frisbiiComparison: f } = data;
  const match = f.delta === 0;

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          Frisbii vs Supabase
        </h2>
        <StatusBadge status={match ? "pass" : "warn"} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Frisbii Active</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {f.frisbiiActiveCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Supabase Active</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">
            {f.supabaseActiveCount}
          </p>
        </div>
      </div>

      {f.delta !== 0 && (
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Delta: {f.delta > 0 ? "+" : ""}
          {f.delta}
        </p>
      )}
    </GlassCard>
  );
}

// ─── Override counts card ────────────────────────────────────

function OverridesCard() {
  const { data } = useDataQuality();
  if (!data) return null;

  return (
    <GlassCard>
      <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
        Manual Overrides
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--text-muted)]">Scope Overrides</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {data.overrideCounts.scopeOverrides}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Tier Overrides</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            {data.overrideCounts.tierOverrides}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// ─── Anomalies table ─────────────────────────────────────────

function AnomaliesCard() {
  const { data } = useDataQuality();
  if (!data) return null;

  const warningsAndFailures = data.anomalies.filter(
    (a) => a.status !== "pass"
  );

  return (
    <GlassCard className="lg:col-span-2">
      <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
        Recent Audit Checks
        {warningsAndFailures.length > 0 && (
          <span className="ml-2 text-amber-400">
            ({warningsAndFailures.length} issue
            {warningsAndFailures.length !== 1 ? "s" : ""})
          </span>
        )}
      </h2>

      {data.anomalies.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No audit checks recorded for this month yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-left text-xs">
                <th className="pb-2 pr-4">Check</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Expected</th>
                <th className="pb-2 pr-4">Actual</th>
                <th className="pb-2">Run</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.slice(0, 15).map((a: AnomalyItem) => (
                <tr
                  key={a.id}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="py-2 pr-4 text-[var(--text-primary)]">
                    {formatCheckName(a.checkName)}
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {a.expectedValue ?? "—"}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {a.actualValue ?? "—"}
                  </td>
                  <td className="py-2 text-[var(--text-muted)] text-xs">
                    {new Date(a.syncRunAt).toLocaleString("da-DK", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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

function formatCheckName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Exclusions table ────────────────────────────────────────

function ExclusionsCard() {
  const { data, refresh } = useDataQuality();
  if (!data) return null;

  async function handleRemove(id: number) {
    await fetch(`/api/data-quality/exclusions?id=${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <GlassCard className="lg:col-span-2">
      <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
        Subscription Exclusions
        <span className="ml-2 text-[var(--text-muted)]">
          ({data.exclusions.length})
        </span>
      </h2>

      {data.exclusions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No subscription exclusions configured. Detected delete/recreate
          patterns will show in the anomalies table above.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-left text-xs">
                <th className="pb-2 pr-4">Customer</th>
                <th className="pb-2 pr-4">Subscription</th>
                <th className="pb-2 pr-4">Reason</th>
                <th className="pb-2 pr-4">Excluded By</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.exclusions.map((e: ExclusionItem) => (
                <tr
                  key={e.id}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="py-2 pr-4 text-[var(--text-primary)]">
                    {e.customerName ?? e.customerHandle}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)] font-mono text-xs">
                    {e.subscriptionHandle}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {e.reason.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)]">
                    {e.excludedBy}
                  </td>
                  <td className="py-2 pr-4 text-[var(--text-muted)] text-xs">
                    {new Date(e.createdAt).toLocaleDateString("da-DK")}
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleRemove(e.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Remove
                    </button>
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

// ─── Main dashboard ──────────────────────────────────────────

export function DataQualityDashboard() {
  const { loading, error } = useDataQuality();

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">
        Data Quality
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReconciliationCard />
        <FrisbiiComparisonCard />
        <OverridesCard />
      </div>

      <AnomaliesCard />
      <ExclusionsCard />
    </div>
  );
}
