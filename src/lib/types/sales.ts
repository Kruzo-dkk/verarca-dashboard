export interface SalesDashboardData {
  month: string;
  targets: SalesTargets;
  pipeline: PipelineDetail;
  activities: ActivitySummary;
  leaderboard: LeaderboardEntry[];
  recentWins: DealOutcome[];
  recentLosses: DealOutcome[];
  employeeComparison: EmployeeComparison[];
}

export interface SalesTargets {
  targetNewMRR: number;
  targetNewLogos: number;
  targetPipeline: number;
  targetMeetings: number;
  targetCalls: number;
  actualNewMRR: number;
  actualNewLogos: number;
  actualPipeline: number;
  actualMeetings: number;
  actualCalls: number;
}

export interface PipelineDetail {
  stages: StageGroup[];
  totalValue: number;
  weightedValue: number;
  dealCount: number;
}

export interface StageGroup {
  stageId: string;
  label: string;
  displayOrder: number;
  deals: SalesDeal[];
  totalValue: number;
  weightedValue: number;
}

export interface SalesDeal {
  id: string;
  name: string;
  amount: number; // DKK øre
  stage: string;
  stageLabel: string;
  /** Stage win-probability as a 0–1 decimal (multiply by 100 for display). */
  probability: number;
  closeDate: string | null;
  daysToClose: number | null;
  ownerName: string | null;
  /** ISO date the deal was created. Null on pre-feature (frozen) snapshots. */
  createdDate: string | null;
  /** ISO date the deal was last modified. Null on pre-feature snapshots. */
  updatedDate: string | null;
  /** Whole days since createdDate (deal age in the sales cycle); null when unknown. */
  ageDays: number | null;
}

export interface ActivitySummary {
  today: ActivityCounts;
  thisWeek: ActivityCounts;
  thisMonth: ActivityCounts;
  byOwner: OwnerActivity[];
}

export interface ActivityCounts {
  calls: number;
  meetings: number;
  emails: number;
}

export interface OwnerActivity {
  ownerId: string;
  ownerName: string;
  today: ActivityCounts;
  thisWeek: ActivityCounts;
  thisMonth: ActivityCounts;
}

export interface LeaderboardEntry {
  ownerId: string;
  ownerName: string;
  dealsWon: number;
  mrrClosed: number; // DKK øre
  totalActivities: number;
}

/** Per-owner roll-up shown in the Employee Comparison panel. */
export interface EmployeeComparison {
  ownerId: string;
  ownerName: string;
  openDealCount: number;
  openPipelineValue: number; // DKK øre
  weightedPipeline: number; // DKK øre
  /** Avg age (days) of this owner's open deals; null when none have a createdate. */
  avgDealAgeDays: number | null;
  dealsWon: number;
  mrrClosed: number; // DKK øre
  /** Win rate as a 0–1 decimal (multiply by 100 for display); 0 when no closed deals. */
  winRate: number;
  totalActivities: number;
}

export interface DealOutcome {
  id: string;
  name: string;
  amount: number; // DKK øre
  closeDate: string;
  ownerName: string | null;
}
