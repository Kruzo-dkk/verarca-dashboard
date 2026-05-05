import type { HubSpotSyncHealth, HubSpotMatchRate, HubSpotApiStatus } from "@/lib/sync/types";
import type { HubSpotSyncCard } from "../HubSpotSyncCard";

type Props = Parameters<typeof HubSpotSyncCard>[0];

// ─── Shared helpers ──────────────────────────────────────────────

const NOW = new Date().toISOString();
const TWO_MIN_AGO = new Date(Date.now() - 2 * 60 * 1000).toISOString();
const TEN_MIN_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

function health(
  module: HubSpotSyncHealth["module"],
  status: HubSpotSyncHealth["status"],
  overrides: Partial<HubSpotSyncHealth> = {}
): HubSpotSyncHealth {
  return {
    module,
    status,
    startedAt: TWO_MIN_AGO,
    durationMs: 1234,
    recordsFetched: 42,
    recordsUpserted: 42,
    errorMessage: null,
    metadata: null,
    ...overrides,
  };
}

// ─── allSuccess ──────────────────────────────────────────────────

export const allSuccess: Props = {
  apiStatus: { ok: true, error: null } satisfies HubSpotApiStatus,
  matchRate: {
    total: 120,
    matched: 108,
    rate: 0.9,
    byConfidence: { high: 80, medium: 20, low: 8 },
  } satisfies HubSpotMatchRate,
  syncHealth: [
    health("pipeline", "success", { startedAt: TWO_MIN_AGO, durationMs: 800, recordsFetched: 15, recordsUpserted: 15 }),
    health("activities", "success", { startedAt: TWO_MIN_AGO, durationMs: 1500, recordsFetched: 203, recordsUpserted: 200 }),
    health("tickets", "success", { startedAt: TWO_MIN_AGO, durationMs: 600, recordsFetched: 7, recordsUpserted: 7 }),
    health("customers", "success", { startedAt: TWO_MIN_AGO, durationMs: 900, recordsFetched: 120, recordsUpserted: 118 }),
  ],
};

// ─── mixed ───────────────────────────────────────────────────────

export const mixed: Props = {
  apiStatus: { ok: true, error: null } satisfies HubSpotApiStatus,
  matchRate: {
    total: 80,
    matched: 52,
    rate: 0.65,
    byConfidence: { high: 30, medium: 15, low: 7 },
  } satisfies HubSpotMatchRate,
  syncHealth: [
    health("pipeline", "success", { startedAt: TEN_MIN_AGO, recordsFetched: 12, recordsUpserted: 12 }),
    health("activities", "failed", {
      startedAt: TEN_MIN_AGO,
      durationMs: 5000,
      recordsFetched: 0,
      recordsUpserted: 0,
      errorMessage: "HubSpot API returned 429 Too Many Requests after 3 retries — rate limit exceeded",
    }),
    // warn: success but 0 upserted
    health("tickets", "success", { startedAt: TEN_MIN_AGO, recordsFetched: 5, recordsUpserted: 0 }),
    health("customers", "running", { startedAt: NOW, durationMs: null, recordsFetched: null, recordsUpserted: null }),
  ],
};

// ─── allFailed ───────────────────────────────────────────────────

export const allFailed: Props = {
  apiStatus: { ok: false, error: "Connection refused: HubSpot EU API unreachable" } satisfies HubSpotApiStatus,
  matchRate: null,
  syncHealth: [
    health("pipeline", "failed", { errorMessage: "Unauthorized: invalid API key", recordsFetched: null, recordsUpserted: null }),
    health("activities", "failed", { errorMessage: "Unauthorized: invalid API key", recordsFetched: null, recordsUpserted: null }),
    health("tickets", "failed", { errorMessage: "Unauthorized: invalid API key", recordsFetched: null, recordsUpserted: null }),
    health("customers", "skipped", { errorMessage: null, recordsFetched: null, recordsUpserted: null }),
  ],
};

// ─── noData ──────────────────────────────────────────────────────

export const noData: Props = {
  apiStatus: { ok: true, error: null } satisfies HubSpotApiStatus,
  matchRate: null,
  syncHealth: [],
};
