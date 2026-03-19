export interface SalesDashboardData {
  month: string;
  targets: SalesTargets;
  pipeline: PipelineDetail;
  activities: ActivitySummary;
  leaderboard: LeaderboardEntry[];
  recentWins: DealOutcome[];
  recentLosses: DealOutcome[];
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
  probability: number;
  closeDate: string | null;
  daysToClose: number | null;
  ownerName: string | null;
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

export interface DealOutcome {
  id: string;
  name: string;
  amount: number; // DKK øre
  closeDate: string;
  ownerName: string | null;
}
