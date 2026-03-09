import type { Tables } from "@/lib/supabase/database.types";
import type { Currency, FXRates } from "@/lib/currency";
import type { MRRDecomposition } from "@/lib/metrics";

// ─── Database Row Types ────────────────────────────────────────

export type MonthlySnapshot = Tables<"monthly_snapshots">;
export type Customer = Tables<"customers">;
export type CustomerSnapshot = Tables<"customer_snapshots">;
export type PipelineSnapshot = Tables<"pipeline_snapshots">;
export type FXRate = Tables<"fx_rates">;

// ─── Report Data (aggregated for dashboard) ────────────────────

export interface ReportData {
  month: string; // YYYY-MM
  currency: Currency;
  fxRates: FXRates;

  // Revenue
  revenue: {
    mrr: number;
    arr: number;
    netNewMRR: number;
    decomposition: MRRDecomposition;
    nonRecurringRevenue: number;
    mrrHistory: { month: string; mrr: number }[];
    arrHistory: { month: string; arr: number }[];
    growthMoM: number | null;
    growthYoY: number | null;
  };

  // Retention
  retention: {
    nrr: number | null;
    grr: number | null;
    logoRetentionRate: number | null;
    quickRatio: number | null;
    cohortData: CohortRow[];
    nrrHistory: { month: string; nrr: number }[];
  };

  // Customers
  customers: {
    count: number;
    newLogos: number;
    churnedLogos: number;
    arpa: number;
    top10Concentration: number | null;
    segments: SegmentBreakdown[];
    topCustomers: CustomerSummary[];
    countHistory: { month: string; count: number }[];
    arpaHistory: { month: string; arpa: number }[];
  };

  // Pipeline (HubSpot)
  pipeline: {
    totalPipelineValue: number; // USD cents
    weightedPipeline: number;
    pipelineCoverage: number | null; // weighted / net new MRR
    dealsWon: number;
    dealsLost: number;
    dealsOpen: number;
    winRate: number | null;
    avgSalesCycleDays: number;
    avgDealSize: number; // USD cents
    deals: PipelineDeal[];
  };

  // Unit Economics
  unitEconomics: {
    ltv: number | null;
    revenuePerEmployee: number | null;
    employeeCount: number | null;
    // Stubbed - requires accounting integration
    cac: null;
    ltvCacRatio: null;
    grossMargin: null;
    ruleOf40: null;
  };

  // Commentary
  commentary: {
    executiveSummary: string | null;
    highlights: string | null;
    lowlights: string | null;
    whatsAhead: string | null;
  };
}

// ─── Supporting Types ──────────────────────────────────────────

export interface CohortRow {
  cohortMonth: string; // YYYY-MM when customers joined
  startCount: number;
  retentionByMonth: { month: string; retainedPercent: number }[];
}

export interface SegmentBreakdown {
  segment: string;
  customerCount: number;
  mrr: number;
  percentOfTotal: number;
}

export interface CustomerSummary {
  id: number;
  name: string;
  mrr: number;
  plan: string | null;
  status: string;
  partner: string | null;
  matchConfidence: string;
}

export interface PipelineDeal {
  id: string;
  name: string;
  amount: number; // USD cents
  stage: string;
  probability: number;
  closeDate: string | null;
  daysToClose: number | null;
  createDate: string;
}

// ─── Report Context (for UI providers) ─────────────────────────

export interface ReportContext {
  month: string;
  currency: Currency;
  fxRates: FXRates;
  setCurrency: (currency: Currency) => void;
  setMonth: (month: string) => void;
}
