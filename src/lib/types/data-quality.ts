export interface DataQualityError {
  component: string;
  message: string;
}

/** One row of the sync_runs log — what each module synced and how it went. */
export interface SyncRunLog {
  id: number;
  module: string;
  month: string | null;
  status: string; // running | success | failed
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  recordsFetched: number | null;
  recordsUpserted: number | null;
  errorMessage: string | null;
}

export interface DataQualityData {
  month: string;
  reconciliation: ReconciliationStatus;
  anomalies: AnomalyItem[];
  exclusions: ExclusionItem[];
  overrideCounts: OverrideCounts;
  frisbiiComparison: FrisbiiComparison;
  syncLog: SyncRunLog[];
  lastSyncAt: string | null;
  errors: DataQualityError[];
  hubspotSyncHealth: import("@/lib/sync/types").HubSpotSyncHealth[];
  hubspotMatchRate: import("@/lib/sync/types").HubSpotMatchRate | null;
  hubspotApiStatus: import("@/lib/sync/types").HubSpotApiStatus;
}

export interface ReconciliationStatus {
  status: "pass" | "warn" | "fail" | "no_data";
  snapshotMRR: number;
  sumCustomerMRR: number;
  delta: number;
}

export interface AnomalyItem {
  id: number;
  checkName: string;
  status: string;
  expectedValue: string | null;
  actualValue: string | null;
  delta: number | null;
  details: string | null;
  syncRunAt: string;
}

export interface ExclusionItem {
  id: number;
  subscriptionHandle: string;
  customerHandle: string;
  customerName: string | null;
  reason: string;
  replacementHandle: string | null;
  excludedBy: string;
  createdAt: string;
}

export interface OverrideCounts {
  scopeOverrides: number;
  tierOverrides: number;
}

export interface FrisbiiComparison {
  frisbiiActiveCount: number;
  supabaseActiveCount: number;
  delta: number;
  error: string | null;
}
