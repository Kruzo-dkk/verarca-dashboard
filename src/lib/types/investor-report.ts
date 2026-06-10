import type { Currency, FXRates } from "@/lib/currency";

/**
 * InvestorReportData — M&A-centric view.
 *
 * Two sections:
 * 1. Revenue Quality — how sticky and predictable is revenue?
 * 2. Growth Efficiency — how capital-efficient is growth?
 *
 * No customer names, no individual deals, no pipeline details.
 */
export interface InvestorReportData {
  month: string;
  currency: Currency;
  fxRates: FXRates;

  // Revenue quality
  revenueQuality: {
    arr: number;
    mrr: number;
    nrr: number | null;
    grr: number | null;
    logoRetentionRate: number | null;
    top10Concentration: number | null;
    growthMoM: number | null;
    growthYoY: number | null;
    arrHistory: { month: string; arr: number }[];
    nrrHistory: { month: string; nrr: number }[];
    customerCount: number;
    arpa: number;
    quickRatio: number | null;
  };

  // Growth efficiency
  growthEfficiency: {
    ltv: number | null;
    cac: number | null;
    ltvCacRatio: number | null;
    revenuePerEmployee: number | null;
    employeeCount: number | null;
    // Driven by manual monthly finance inputs (gross margin, net burn, S&M spend)
    cacPaybackMonths: number | null;
    ruleOf40: number | null;
    burnMultiple: number | null;
    magicNumber: number | null;
    grossMargin: number | null;
  };
}
