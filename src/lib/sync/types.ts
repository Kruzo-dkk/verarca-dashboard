/**
 * Sync run lifecycle status, mirrors the sync_runs.status check constraint.
 */
export type SyncStatus = "running" | "success" | "failed" | "skipped";

/**
 * Contract returned by every sync module. Captured per run by runModule()
 * and persisted to sync_runs for diagnostics.
 */
export interface SyncModuleResult {
  /** Records fetched from the external API. Null if the module does not fetch. */
  recordsFetched: number | null;
  /** Records upserted into Supabase (inserts + updates). */
  recordsUpserted: number;
  /** Module-specific diagnostic fields. Stored as JSONB in sync_runs.metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Per-module HubSpot sync health snapshot, surfaced on /data-quality.
 */
export interface HubSpotSyncHealth {
  module: "pipeline" | "activities" | "tickets" | "customers";
  status: SyncStatus;
  startedAt: string;
  durationMs: number | null;
  recordsFetched: number | null;
  recordsUpserted: number | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
}

export interface HubSpotMatchRate {
  total: number;
  matched: number;
  rate: number;
  byConfidence: { high: number; medium: number; low: number };
}

export interface HubSpotApiStatus {
  ok: boolean;
  error: string | null;
}
