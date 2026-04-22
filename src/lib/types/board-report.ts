import type { Currency, FXRates } from "@/lib/currency";
import type { MRRDecomposition } from "@/lib/metrics";

/**
 * BoardReportData is a strict subset of ReportData.
 * No customer names, no individual deals, no forecast assumptions.
 */
export interface BoardReportData {
  month: string;
  currency: Currency;
  fxRates: FXRates;

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

  retention: {
    nrr: number | null;
    grr: number | null;
    logoRetentionRate: number | null;
    logoChurnRate: number | null;
    revenueChurnRate: number | null;
    quickRatio: number | null;
    nrrHistory: { month: string; nrr: number }[];
  };

  customers: {
    count: number;
    newLogos: number;
    churnedLogos: number;
    churnedMRR: number;
    arpa: number;
    top10Concentration: number | null;
  };

  pipeline: {
    totalPipelineValue: number;
    weightedPipeline: number;
    pipelineCoverage: number | null;
    dealsWon: number;
    dealsLost: number;
    dealsOpen: number;
    winRate: number | null;
    avgSalesCycleDays: number;
    avgDealSize: number;
  };

  commentary: {
    executiveSummary: string | null;
    highlights: string | null;
    lowlights: string | null;
    whatsAhead: string | null;
  };
}
