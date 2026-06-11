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

/** A scenario's assumptions plus UI metadata returned by the API. */
export interface ScenarioAssumptionMeta extends ForecastAssumptions {
  isCustom: boolean; // false for predicted and for uncustomized (suggested) bands
  readOnly: boolean; // true only for predicted
}

export interface ForecastResult {
  historical: { month: string; mrr: number; arr: number }[];
  projections: ForecastScenario[];
  assumptions: ScenarioAssumptionMeta[]; // 4 entries: predicted, worst, better, best
  currentMRR: number;
  currentARPA: number;
  sufficientHistory: boolean; // false → predicted falls back to defaults
  predictedWindow: number; // trailing months used for the predicted derivation
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
 * New-business MRR per month from a projection: new-logo run-rate + weighted
 * pipeline (the two net-new components a sales New-MRR budget targets). Keyed
 * YYYY-MM, DKK øre.
 */
export function forecastNewMrrByMonth(months: ForecastMonth[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of months) out[m.month] = m.newLogoAmount + m.pipelineAmount;
  return out;
}

/**
 * Add N months to a YYYY-MM string.
 */
function addMonths(yearMonth: string, n: number): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Predicted scenario (auto-derived from trailing actuals) ──────────

/**
 * A trailing monthly snapshot row used to derive the predicted assumptions.
 * All monetary fields are DKK øre.
 */
export interface TrailingSnapshot {
  month: string; // YYYY-MM
  mrr: number; // end-of-month MRR
  churned_mrr: number; // revenue lost to full cancellations (positive)
  contraction_mrr: number; // revenue lost to downgrades (positive)
  expansion_mrr: number; // gross expansion from existing customers
  new_mrr: number; // MRR from new logos
  new_logos: number; // all new logos, incl. zero-MRR signups
  new_paying_logos?: number | null; // new logos with mrr>0 — preferred denominator
  arpa: number;
}

/** Defaults used when there is too little history to derive a prediction. */
export const PREDICTED_FALLBACK: Omit<ForecastAssumptions, "scenario"> = {
  monthlyChurnPct: 2.5,
  monthlyExpansionPct: 1.0,
  newLogosPerMonth: 2,
  avgNewDealSize: 0,
  pipelineConversionPct: 20,
};

/** Clamp a percentage to the [0, 100] range. */
export function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/**
 * Derive the "predicted" assumptions from a trailing window of snapshots plus
 * the live pipeline win-rate. Rates are MRR-weighted across the window (sum of
 * flows ÷ sum of prior-month MRR), never a mean of monthly ratios.
 *
 * `trailing` must be the window's snapshots in any order, including one extra
 * predecessor month so the earliest in-window month has a prior MRR.
 *
 * Churn is GROSS revenue churn (cancellations + downgrades); expansion is gross.
 */
export function computePredictedAssumptions(
  trailing: TrailingSnapshot[],
  pipelineWinRate: number | null
): { assumptions: ForecastAssumptions; sufficientHistory: boolean } {
  const rows = [...trailing].sort((a, b) => a.month.localeCompare(b.month));
  const conversion =
    pipelineWinRate != null
      ? clampPct(pipelineWinRate)
      : PREDICTED_FALLBACK.pipelineConversionPct;

  // Need at least 3 rows (≥2 month-transitions) to read a trend.
  if (rows.length < 3) {
    const latestArpa = rows.length ? rows[rows.length - 1].arpa : 0;
    return {
      assumptions: {
        scenario: "predicted",
        ...PREDICTED_FALLBACK,
        avgNewDealSize: latestArpa,
        pipelineConversionPct: conversion,
      },
      sufficientHistory: false,
    };
  }

  let churnNum = 0; // Σ (churned + contraction) over months with a positive prior MRR
  let expNum = 0; // Σ expansion over those months
  let baseDen = 0; // Σ prior-month MRR
  let logoSum = 0; // Σ new logos over the window months
  let newMrrSum = 0; // Σ new MRR over the window months
  let monthsCount = 0; // window months (transitions)

  for (let i = 1; i < rows.length; i++) {
    const cur = rows[i];
    const prevMrr = rows[i - 1].mrr;

    // Run-rate counts every window month (a zero-base month can still add logos).
    // Prefer PAYING new logos (mrr>0) so "New logos/month" and "Avg new-deal MRR"
    // (= new_mrr ÷ logos) are intuitive and not dragged down by zero-MRR signups.
    // Falls back to all new_logos for months not yet backfilled.
    logoSum += cur.new_paying_logos ?? cur.new_logos;
    newMrrSum += cur.new_mrr;
    monthsCount++;

    // Rates require a positive base to avoid divide-by-zero / NaN.
    if (prevMrr > 0) {
      churnNum += cur.churned_mrr + cur.contraction_mrr;
      expNum += cur.expansion_mrr;
      baseDen += prevMrr;
    }
  }

  const latestArpa = rows[rows.length - 1].arpa;
  const monthlyChurnPct =
    baseDen > 0 ? clampPct((churnNum / baseDen) * 100) : PREDICTED_FALLBACK.monthlyChurnPct;
  const monthlyExpansionPct =
    baseDen > 0 ? clampPct((expNum / baseDen) * 100) : PREDICTED_FALLBACK.monthlyExpansionPct;
  const newLogosPerMonth = monthsCount > 0 ? Math.max(0, logoSum / monthsCount) : 0;
  const avgNewDealSize = logoSum > 0 ? Math.round(newMrrSum / logoSum) : latestArpa;

  return {
    assumptions: {
      scenario: "predicted",
      monthlyChurnPct,
      monthlyExpansionPct,
      newLogosPerMonth,
      avgNewDealSize,
      pipelineConversionPct: conversion,
    },
    sufficientHistory: true,
  };
}

// ─── Suggested bands (derived from predicted, user-correctable) ───────

const BAND_MULTIPLIERS: Record<
  "worst" | "better" | "best",
  { churn: number; expansion: number; newLogos: number }
> = {
  worst: { churn: 1.5, expansion: 0.5, newLogos: 0.5 },
  better: { churn: 0.8, expansion: 1.25, newLogos: 1.25 },
  best: { churn: 0.5, expansion: 1.75, newLogos: 1.75 },
};

/**
 * Suggest a worst/better/best band by scaling the predicted churn, expansion,
 * and new-logo run-rate. Deal economics (avg deal size, pipeline conversion)
 * pass through unchanged. Because churn moves opposite to growth, projected MRR
 * orders worst ≤ predicted ≤ better ≤ best for any non-degenerate prediction.
 */
export function deriveSuggestedBand(
  predicted: ForecastAssumptions,
  scenario: "worst" | "better" | "best"
): ForecastAssumptions {
  const m = BAND_MULTIPLIERS[scenario];
  // Round suggestions to one decimal so the editable inputs show clean starting
  // values (predicted is fractional, so unrounded products like 2.6667 read as noise).
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    scenario,
    monthlyChurnPct: clampPct(round1(predicted.monthlyChurnPct * m.churn)),
    monthlyExpansionPct: clampPct(round1(predicted.monthlyExpansionPct * m.expansion)),
    newLogosPerMonth: Math.max(0, round1(predicted.newLogosPerMonth * m.newLogos)),
    avgNewDealSize: predicted.avgNewDealSize,
    pipelineConversionPct: predicted.pipelineConversionPct,
  };
}
