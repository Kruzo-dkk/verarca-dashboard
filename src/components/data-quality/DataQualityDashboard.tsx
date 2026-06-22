"use client";

import { useState } from "react";
import { useDataQuality } from "./DataQualityProvider";
import { useReportContext } from "@/components/providers/ReportProvider";
import { GlassCard } from "@/components/ui/GlassCard";
import { HubSpotSyncCard } from "./HubSpotSyncCard";
import { SuggestedLinksCard } from "./SuggestedLinksCard";
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

// ─── Sync status bar ────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SyncStatusBar() {
  const { data } = useDataQuality();
  if (!data) return null;

  const lastSync = data.lastSyncAt
    ? new Date(data.lastSyncAt)
    : null;

  const timeAgo = lastSync
    ? formatTimeAgo(lastSync)
    : null;

  return (
    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
      {lastSync ? (
        <>
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          Last sync: {timeAgo}
        </>
      ) : (
        <>
          <span className="inline-block w-2 h-2 rounded-full bg-zinc-500" />
          No syncs recorded for this month
        </>
      )}
      {data.errors.length > 0 && (
        <span className="text-amber-400">
          · {data.errors.length} error{data.errors.length !== 1 ? "s" : ""}
        </span>
      )}
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

      {r.status === "no_data" ? (
        <p className="text-sm text-[var(--text-muted)]">
          Waiting for first sync of the month
        </p>
      ) : (
        <>
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
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Tolerance: ±10 DKK
          </p>
        </>
      )}
    </GlassCard>
  );
}

// ─── Frisbii comparison card ─────────────────────────────────

function FrisbiiComparisonCard() {
  const { data } = useDataQuality();
  if (!data) return null;

  const { frisbiiComparison: f } = data;

  // Frisbii = currently active customers (point-in-time)
  // Supabase = customers active at any point this month (month-boundary)
  // Supabase >= Frisbii is expected (includes mid-month churn)
  // Frisbii > Supabase is a problem (customers not synced)
  const supabaseAhead = f.supabaseActiveCount > f.frisbiiActiveCount;
  const frisbiiAhead = f.frisbiiActiveCount > f.supabaseActiveCount;

  let status: string;
  if (f.error) status = "warn";
  else if (frisbiiAhead) status = "warn"; // customers in Frisbii missing from sync
  else status = "pass"; // match or Supabase ahead (expected)

  const absDelta = Math.abs(f.delta);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-[var(--text-secondary)]">
            Active Customers
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Frisbii (current) vs Supabase (this month)
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {f.error ? (
        <p className="text-sm text-amber-400">{f.error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                Frisbii (now)
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {f.frisbiiActiveCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">
                Supabase (month)
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {f.supabaseActiveCount}
              </p>
            </div>
          </div>

          {absDelta > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {supabaseAhead
                ? `${absDelta} customer${absDelta !== 1 ? "s" : ""} churned this month (still counted in monthly snapshot)`
                : frisbiiAhead
                  ? `${absDelta} customer${absDelta !== 1 ? "s" : ""} in Frisbii not yet synced to Supabase`
                  : null}
            </p>
          )}
        </>
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
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;

  const filtered = showAll
    ? data.anomalies
    : data.anomalies.filter((a) => a.status !== "pass");

  // Group by sync run
  const grouped = new Map<string, AnomalyItem[]>();
  for (const a of filtered) {
    const key = a.syncRunAt;
    const existing = grouped.get(key) ?? [];
    existing.push(a);
    grouped.set(key, existing);
  }

  const issueCount = data.anomalies.filter((a) => a.status !== "pass").length;

  return (
    <GlassCard className="lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          Audit Checks
          {issueCount > 0 && (
            <span className="ml-2 text-amber-400">
              ({issueCount} issue{issueCount !== 1 ? "s" : ""})
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          {showAll ? "Issues only" : `Show all (${data.anomalies.length})`}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          {data.anomalies.length === 0
            ? "No audit checks recorded for this month yet."
            : "All checks passing"}
        </p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].slice(0, 5).map(([syncRunAt, checks]) => (
            <div key={syncRunAt}>
              <p className="text-xs text-[var(--text-muted)] mb-2">
                Sync at{" "}
                {new Date(syncRunAt).toLocaleString("da-DK", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {checks.map((a: AnomalyItem) => (
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
                      <td className="py-2 pr-4 text-[var(--text-muted)] text-xs max-w-xs truncate">
                        {a.details ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
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

function HubSpotSyncSection() {
  const { data } = useDataQuality();
  if (!data) return null;
  return (
    <HubSpotSyncCard
      syncHealth={data.hubspotSyncHealth}
      matchRate={data.hubspotMatchRate}
      apiStatus={data.hubspotApiStatus}
    />
  );
}

// Headline-figure reconciliation checks, in display order. Keys must match the
// check_name written by validate-sync.ts.
const INTEGRITY_CHECKS: Record<string, string> = {
  mrr_reconciliation: "MRR = Σ customer snapshots",
  mrr_waterfall_identity: "MRR waterfall closes",
  nrr_grr_consistency: "NRR ≥ GRR ⟺ expansion",
  arr_arpa_identity: "ARR = MRR×12, ARPA = MRR/customers",
};

function MetricIntegrityCard() {
  const { data } = useDataQuality();
  if (!data) return null;

  const anomalies = data.anomalies ?? [];
  // Only the most recent validation run.
  const latestAt = anomalies[0]?.syncRunAt;
  const checks = anomalies.filter(
    (a) => a.syncRunAt === latestAt && a.checkName in INTEGRITY_CHECKS
  );
  if (checks.length === 0) return null;

  const failing = checks.filter((c) => c.status === "fail");
  const warning = checks.filter((c) => c.status === "warn");
  const overall = failing.length ? "fail" : warning.length ? "warn" : "pass";

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Metric Integrity
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Headline figures reconcile with their own components
          </p>
        </div>
        <StatusBadge status={overall} />
      </div>
      <div className="space-y-1.5">
        {Object.entries(INTEGRITY_CHECKS).map(([key, label]) => {
          const c = checks.find((x) => x.checkName === key);
          return (
            <div
              key={key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-[var(--text-secondary)]">{label}</span>
              <StatusBadge status={c?.status ?? "no_data"} />
            </div>
          );
        })}
      </div>
      {(failing.length > 0 || warning.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-[var(--border-subtle)] pt-2">
          {[...failing, ...warning].map((c) => (
            <p
              key={c.checkName}
              className={`text-xs ${c.status === "fail" ? "text-red-400" : "text-amber-400"}`}
            >
              {c.details ?? `${c.checkName}: ${c.status}`}
            </p>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function formatSyncTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SyncLogCard() {
  const { data } = useDataQuality();
  const [showAll, setShowAll] = useState(false);
  if (!data) return null;

  const log = data.syncLog ?? [];
  const rows = showAll ? log : log.slice(0, 30);
  const badgeStatus = (s: string) =>
    s === "success" ? "pass" : s === "failed" ? "fail" : s === "running" ? "warn" : "no_data";

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          Sync Log
          <span className="ml-2 text-[var(--text-muted)] text-xs">
            ({log.length} run{log.length !== 1 ? "s" : ""})
          </span>
        </h2>
        {log.length > 30 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            {showAll ? "Show recent" : `Show all (${log.length})`}
          </button>
        )}
      </div>

      {log.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No sync runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-card)]">
              <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
                <th className="pb-2 font-medium">Module</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Started</th>
                <th className="pb-2 font-medium text-right">Duration</th>
                <th className="pb-2 font-medium text-right">Records</th>
                <th className="pb-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border-subtle)]">
                  <td className="py-1.5 text-[var(--text-primary)] whitespace-nowrap">
                    {r.module}
                    {r.month && (
                      <span className="text-[var(--text-muted)]"> · {r.month}</span>
                    )}
                  </td>
                  <td className="py-1.5">
                    <StatusBadge status={badgeStatus(r.status)} />
                  </td>
                  <td className="py-1.5 text-[var(--text-secondary)] text-xs whitespace-nowrap">
                    {formatSyncTime(r.startedAt)}
                  </td>
                  <td className="py-1.5 text-[var(--text-secondary)] text-xs text-right tabular-nums">
                    {r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="py-1.5 text-[var(--text-secondary)] text-xs text-right tabular-nums whitespace-nowrap">
                    {r.recordsUpserted != null || r.recordsFetched != null
                      ? `${r.recordsFetched ?? 0}→${r.recordsUpserted ?? 0}`
                      : "—"}
                  </td>
                  <td className="py-1.5 text-xs max-w-xs truncate">
                    {r.errorMessage ? (
                      <span className="text-red-400" title={r.errorMessage}>
                        {r.errorMessage}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
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
      <SyncStatusBar />

      <MetricIntegrityCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReconciliationCard />
        <FrisbiiComparisonCard />
        <OverridesCard />
      </div>

      <HubSpotSyncSection />
      <SuggestedLinksCard />
      <AnomaliesCard />
      <ExclusionsCard />
      <SyncLogCard />
    </div>
  );
}
