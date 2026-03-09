/**
 * Forecast engine: projects MRR forward based on scenario assumptions.
 *
 * For each month in the horizon:
 *   1. Start with previous month MRR
 *   2. - churn: MRR × churnPct%
 *   3. + expansion: MRR × expansionPct%
 *   4. + new logos: newLogosPerMonth × avgDealSize
 *   5. + pipeline: weighted deals with close dates in this month
 */

export interface ForecastAssumptions {
  scenario: string; // "best" | "base" | "worst"
  monthlyChurnPct: number;
  monthlyExpansionPct: number;
  newLogosPerMonth: number;
  avgNewDealSize: number; // DKK øre
  pipelineConversionPct: number;
}

export interface ForecastMonth {
  month: string; // YYYY-MM
  mrr: number; // DKK øre
  arr: number; // DKK øre
  churnAmount: number;
  expansionAmount: number;
  newLogoAmount: number;
  pipelineAmount: number;
}

export interface ForecastScenario {
  scenario: string;
  months: ForecastMonth[];
}

export interface ForecastResult {
  historical: { month: string; mrr: number; arr: number }[];
  projections: ForecastScenario[];
  assumptions: ForecastAssumptions[];
  currentMRR: number;
  currentARPA: number;
}

interface PipelineDeal {
  amount: number; // DKK øre
  probability: number; // 0-100
  closeDate: string | null;
}

/**
 * Project MRR forward for a single scenario.
 */
export function projectScenario(
  startMRR: number,
  assumptions: ForecastAssumptions,
  horizon: number,
  startMonth: string,
  pipelineDeals: PipelineDeal[] = []
): ForecastMonth[] {
  const months: ForecastMonth[] = [];
  let currentMRR = startMRR;

  for (let i = 1; i <= horizon; i++) {
    const monthStr = addMonths(startMonth, i);

    // Churn
    const churnAmount = Math.round(
      currentMRR * (assumptions.monthlyChurnPct / 100)
    );

    // Expansion
    const expansionAmount = Math.round(
      currentMRR * (assumptions.monthlyExpansionPct / 100)
    );

    // New logos
    const newLogoAmount =
      assumptions.newLogosPerMonth * assumptions.avgNewDealSize;

    // Pipeline deals closing this month
    let pipelineAmount = 0;
    for (const deal of pipelineDeals) {
      if (deal.closeDate && deal.closeDate.startsWith(monthStr)) {
        pipelineAmount += Math.round(
          deal.amount * (assumptions.pipelineConversionPct / 100)
        );
      }
    }

    // Net MRR change
    const netChange = expansionAmount + newLogoAmount + pipelineAmount - churnAmount;
    currentMRR = Math.max(0, currentMRR + netChange);

    months.push({
      month: monthStr,
      mrr: currentMRR,
      arr: currentMRR * 12,
      churnAmount,
      expansionAmount,
      newLogoAmount,
      pipelineAmount,
    });
  }

  return months;
}

/**
 * Add N months to a YYYY-MM string.
 */
function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
