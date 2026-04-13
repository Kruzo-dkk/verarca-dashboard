export interface DataQualityError {
  component: string;
  message: string;
}

export interface DataQualityData {
  month: string;
  reconciliation: ReconciliationStatus;
  anomalies: AnomalyItem[];
  exclusions: ExclusionItem[];
  overrideCounts: OverrideCounts;
  frisbiiComparison: FrisbiiComparison;
  lastSyncAt: string | null;
  errors: DataQualityError[];
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
