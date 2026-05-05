"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type {
  HubSpotSyncHealth,
  HubSpotMatchRate,
  HubSpotApiStatus,
} from "@/lib/sync/types";

interface HubSpotSyncCardProps {
  syncHealth: HubSpotSyncHealth[];
  matchRate: HubSpotMatchRate | null;
  apiStatus: HubSpotApiStatus;
}

const MODULE_LABELS: Record<HubSpotSyncHealth["module"], string> = {
  pipeline: "Pipeline",
  activities: "Aktivitet",
  tickets: "Tickets",
  customers: "Kunder",
};

function formatMinutesAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "lige nu";
  if (minutes === 1) return "1 minut siden";
  return `${minutes} minutter siden`;
}

type ModuleStatusKind = "success" | "warn" | "failed" | "running" | "skipped";

function resolveModuleStatus(h: HubSpotSyncHealth): ModuleStatusKind {
  if (h.status === "failed") return "failed";
  if (h.status === "running") return "running";
  if (h.status === "skipped") return "skipped";
  // success but nothing upserted → warn
  if (h.status === "success" && (h.recordsUpserted === 0 || h.recordsUpserted === null)) {
    return "warn";
  }
  return "success";
}

const MODULE_STATUS_CONFIG: Record<ModuleStatusKind, { label: string; icon: string; className: string }> = {
  success: { label: "OK",            icon: "✓", className: "bg-emerald-500/20 text-emerald-400" },
  warn:    { label: "Advarsel",      icon: "⚠", className: "bg-amber-500/20 text-amber-400" },
  failed:  { label: "Fejl",          icon: "✗", className: "bg-red-500/20 text-red-400" },
  running: { label: "Kører",         icon: "⏳", className: "bg-blue-500/20 text-blue-400" },
  skipped: { label: "Sprunget over", icon: "·", className: "bg-zinc-500/20 text-zinc-400" },
};

function ModuleStatusBadge({ kind }: { kind: ModuleStatusKind }) {
  const cfg = MODULE_STATUS_CONFIG[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
    >
      {cfg.icon} {cfg.label}
    </span>
  );
}

function ModuleRow({ h }: { h: HubSpotSyncHealth }) {
  const kind = resolveModuleStatus(h);
  const label = MODULE_LABELS[h.module];
  const fetched = h.recordsFetched != null ? h.recordsFetched : "—";
  const upserted = h.recordsUpserted != null ? h.recordsUpserted : "—";
  const truncatedError =
    h.errorMessage && h.errorMessage.length > 200
      ? h.errorMessage.slice(0, 200) + "…"
      : h.errorMessage;

  return (
    <div className="py-2 border-t border-[var(--border-subtle)]">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-[var(--text-primary)] font-medium">
          {label}
        </span>
        <ModuleStatusBadge kind={kind} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--text-muted)]">
        <span>Sidst kørt for {formatMinutesAgo(h.startedAt)}</span>
        <span>
          Hentet: {fetched} → upserted: {upserted}
        </span>
      </div>
      {truncatedError && (
        <p className="mt-1 text-xs text-red-400 break-words">{truncatedError}</p>
      )}
    </div>
  );
}

function MatchRateSection({ matchRate }: { matchRate: HubSpotMatchRate }) {
  const pct = Math.round(matchRate.rate * 100);
  const { high, medium, low } = matchRate.byConfidence;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
      <p className="text-xs text-[var(--text-muted)] mb-1">Kundematch</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
          {pct}%
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-1">
        {matchRate.matched}/{matchRate.total} kunder matchet
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">
        high: {high} · medium: {medium} · low: {low}
      </p>
    </div>
  );
}

export function HubSpotSyncCard({
  syncHealth,
  matchRate,
  apiStatus,
}: HubSpotSyncCardProps): React.JSX.Element {
  const isEmpty =
    syncHealth.length === 0 && matchRate === null;

  const apiOk = apiStatus?.ok ?? false;

  return (
    <GlassCard>
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">
          HubSpot sync
        </h2>
      </div>

      {/* API status */}
      <div className="mb-3">
        {apiOk ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
            ✓ HubSpot API tilgængelig
          </span>
        ) : (
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
              ✗ HubSpot API utilgængelig
            </span>
            {apiStatus?.error && (
              <p className="mt-1 text-xs text-red-400">{apiStatus.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <p className="text-sm text-[var(--text-muted)]">
          Ingen sync-data endnu
        </p>
      ) : (
        <>
          {/* Module rows */}
          {syncHealth.map((h) => (
            <ModuleRow key={h.module} h={h} />
          ))}

          {/* Match-rate */}
          {matchRate !== null && <MatchRateSection matchRate={matchRate} />}
        </>
      )}
    </GlassCard>
  );
}
