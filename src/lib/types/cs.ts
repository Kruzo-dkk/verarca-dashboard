export interface CSDashboardData {
  month: string;
  tierBreakdown: TierBreakdown;
  onboarding: OnboardingData;
  healthDistribution: HealthDistribution;
  supportMetrics: SupportMetrics;
  atRiskCustomers: CSCustomer[];
  managedPerformance: ManagedPerformance;
}

export interface TierBreakdown {
  managed: TierStats;
  standard: TierStats;
  unassigned: TierStats;
}

export interface TierStats {
  count: number;
  mrr: number;
  percentOfTotal: number;
}

export interface OnboardingData {
  notStarted: number;
  inProgress: number;
  completed: number;
  avgDaysToOnboard: number | null;
  customers: OnboardingCustomer[];
}

export interface OnboardingCustomer {
  id: number;
  name: string;
  status: "not_started" | "in_progress" | "completed";
  daysSinceStart: number | null;
  overdueTasks: number;
}

export interface HealthDistribution {
  healthy: number;
  neutral: number;
  atRisk: number;
}

export interface SupportMetrics {
  openTickets: number;
  avgResolutionHours: number | null;
  ticketsThisMonth: number;
  ticketsLastMonth: number;
  ticketTrend: number; // percentage change
}

export interface CSCustomer {
  id: number;
  name: string;
  tier: string | null;
  scope: string | null;
  mrr: number;
  mrrTrend: "expanding" | "flat" | "contracting";
  healthScore: number;
  healthLabel: "healthy" | "neutral" | "at_risk";
  healthFactors: string[];
  startDate: string | null;
  openTickets: number;
  daysSinceLastActivity: number | null;
}

export interface ManagedPerformance {
  managedRetentionRate: number | null;
  standardRetentionRate: number | null;
  managedAvgMRR: number;
  standardAvgMRR: number;
  managedGrowthRate: number | null;
  standardGrowthRate: number | null;
}
