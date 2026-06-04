/**
 * SaaS Benchmark Data
 *
 * Static benchmarks from public reports by industry-standard sources.
 * Organized by ARR stage, with median and top-quartile values for key SaaS metrics.
 *
 * Sources:
 *  - Bessemer Cloud Index (2024)
 *  - OpenView SaaS Benchmarks (2024)
 *  - KeyBanc SaaS Survey (2024)
 *
 * All values are percentages (100 = 100%), multiples (3.0 = 3.0x),
 * or months (18 = 18 months) depending on the metric.
 */

// ─── Types ─────────────────────────────────────────────────────

export type BenchmarkSource = "bessemer" | "openview" | "keybanc";

export type ARRStage =
  | "0-1M"
  | "1-5M"
  | "5-10M"
  | "10-25M"
  | "25-50M"
  | "50M+";

export type BenchmarkMetricKey =
  | "nrr"
  | "grr"
  | "logoRetention"
  | "growthRate"
  | "ltvCac"
  | "cacPayback"
  | "ruleOf40"
  | "burnMultiple"
  | "magicNumber"
  | "grossMargin";

export interface BenchmarkValue {
  median: number;
  topQuartile: number;
}

export interface BenchmarkStage {
  stage: ARRStage;
  label: string;
  metrics: Partial<Record<BenchmarkMetricKey, BenchmarkValue>>;
}

export interface BenchmarkSourceData {
  source: BenchmarkSource;
  label: string;
  year: number;
  url: string;
  stages: BenchmarkStage[];
}

// ─── Metric Metadata ───────────────────────────────────────────

export interface BenchmarkMetricMeta {
  label: string;
  unit: string;
  format: (v: number) => string;
  /** True if a higher value is better (e.g., NRR). False if lower is better (e.g., CAC payback). */
  higherIsBetter: boolean;
}

export const BENCHMARK_METRICS: Record<BenchmarkMetricKey, BenchmarkMetricMeta> = {
  nrr: {
    label: "Net Revenue Retention",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
  grr: {
    label: "Gross Revenue Retention",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
  logoRetention: {
    label: "Logo Retention",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
  growthRate: {
    label: "ARR Growth Rate",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
  ltvCac: {
    label: "LTV / CAC",
    unit: "x",
    format: (v) => `${v.toFixed(1)}x`,
    higherIsBetter: true,
  },
  cacPayback: {
    label: "CAC Payback",
    unit: "mo",
    format: (v) => `${v.toFixed(0)} mo`,
    higherIsBetter: false,
  },
  ruleOf40: {
    label: "Rule of 40",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
  burnMultiple: {
    label: "Burn Multiple",
    unit: "x",
    format: (v) => `${v.toFixed(1)}x`,
    higherIsBetter: false,
  },
  magicNumber: {
    label: "Magic Number",
    unit: "",
    format: (v) => v.toFixed(2),
    higherIsBetter: true,
  },
  grossMargin: {
    label: "Gross Margin",
    unit: "%",
    format: (v) => `${v.toFixed(0)}%`,
    higherIsBetter: true,
  },
};

// ─── Benchmark Data ────────────────────────────────────────────

export const BENCHMARK_DATA: BenchmarkSourceData[] = [
  // ── Bessemer Cloud Index ────────────────────────────────────
  {
    source: "bessemer",
    label: "Bessemer Cloud Index",
    year: 2024,
    url: "https://www.bvp.com/cloud-index",
    stages: [
      {
        stage: "0-1M",
        label: "<$1M ARR",
        metrics: {
          nrr: { median: 90, topQuartile: 105 },
          grr: { median: 80, topQuartile: 90 },
          growthRate: { median: 100, topQuartile: 200 },
          ltvCac: { median: 1.5, topQuartile: 3.0 },
          cacPayback: { median: 30, topQuartile: 18 },
          burnMultiple: { median: 4.0, topQuartile: 2.0 },
          grossMargin: { median: 65, topQuartile: 75 },
        },
      },
      {
        stage: "1-5M",
        label: "$1-5M ARR",
        metrics: {
          nrr: { median: 100, topQuartile: 115 },
          grr: { median: 85, topQuartile: 92 },
          growthRate: { median: 80, topQuartile: 150 },
          ltvCac: { median: 2.5, topQuartile: 4.0 },
          cacPayback: { median: 24, topQuartile: 14 },
          burnMultiple: { median: 2.5, topQuartile: 1.2 },
          grossMargin: { median: 70, topQuartile: 80 },
        },
      },
      {
        stage: "5-10M",
        label: "$5-10M ARR",
        metrics: {
          nrr: { median: 105, topQuartile: 120 },
          grr: { median: 87, topQuartile: 93 },
          growthRate: { median: 60, topQuartile: 100 },
          ltvCac: { median: 3.0, topQuartile: 5.0 },
          cacPayback: { median: 20, topQuartile: 12 },
          burnMultiple: { median: 2.0, topQuartile: 1.0 },
          grossMargin: { median: 72, topQuartile: 82 },
        },
      },
      {
        stage: "10-25M",
        label: "$10-25M ARR",
        metrics: {
          nrr: { median: 110, topQuartile: 125 },
          grr: { median: 90, topQuartile: 95 },
          growthRate: { median: 50, topQuartile: 80 },
          ltvCac: { median: 3.5, topQuartile: 6.0 },
          cacPayback: { median: 18, topQuartile: 10 },
          burnMultiple: { median: 1.5, topQuartile: 0.8 },
          ruleOf40: { median: 30, topQuartile: 55 },
          grossMargin: { median: 75, topQuartile: 85 },
        },
      },
      {
        stage: "25-50M",
        label: "$25-50M ARR",
        metrics: {
          nrr: { median: 112, topQuartile: 130 },
          grr: { median: 92, topQuartile: 96 },
          growthRate: { median: 40, topQuartile: 65 },
          ltvCac: { median: 4.0, topQuartile: 7.0 },
          cacPayback: { median: 16, topQuartile: 9 },
          burnMultiple: { median: 1.2, topQuartile: 0.6 },
          ruleOf40: { median: 35, topQuartile: 60 },
          grossMargin: { median: 78, topQuartile: 87 },
        },
      },
    ],
  },

  // ── OpenView SaaS Benchmarks ───────────────────────────────
  {
    source: "openview",
    label: "OpenView SaaS Benchmarks",
    year: 2024,
    url: "https://openviewpartners.com/saas-benchmarks",
    stages: [
      {
        stage: "0-1M",
        label: "<$1M ARR",
        metrics: {
          nrr: { median: 88, topQuartile: 102 },
          grr: { median: 78, topQuartile: 88 },
          logoRetention: { median: 80, topQuartile: 90 },
          growthRate: { median: 90, topQuartile: 180 },
          ltvCac: { median: 1.3, topQuartile: 2.8 },
          cacPayback: { median: 28, topQuartile: 16 },
          magicNumber: { median: 0.3, topQuartile: 0.7 },
          grossMargin: { median: 62, topQuartile: 73 },
        },
      },
      {
        stage: "1-5M",
        label: "$1-5M ARR",
        metrics: {
          nrr: { median: 100, topQuartile: 112 },
          grr: { median: 84, topQuartile: 91 },
          logoRetention: { median: 85, topQuartile: 92 },
          growthRate: { median: 75, topQuartile: 140 },
          ltvCac: { median: 2.2, topQuartile: 3.8 },
          cacPayback: { median: 22, topQuartile: 13 },
          magicNumber: { median: 0.5, topQuartile: 0.9 },
          grossMargin: { median: 68, topQuartile: 78 },
        },
      },
      {
        stage: "5-10M",
        label: "$5-10M ARR",
        metrics: {
          nrr: { median: 104, topQuartile: 118 },
          grr: { median: 86, topQuartile: 92 },
          logoRetention: { median: 87, topQuartile: 93 },
          growthRate: { median: 55, topQuartile: 95 },
          ltvCac: { median: 2.8, topQuartile: 4.5 },
          cacPayback: { median: 19, topQuartile: 11 },
          magicNumber: { median: 0.55, topQuartile: 1.0 },
          grossMargin: { median: 71, topQuartile: 80 },
        },
      },
      {
        stage: "10-25M",
        label: "$10-25M ARR",
        metrics: {
          nrr: { median: 108, topQuartile: 122 },
          grr: { median: 89, topQuartile: 94 },
          logoRetention: { median: 89, topQuartile: 95 },
          growthRate: { median: 45, topQuartile: 75 },
          ltvCac: { median: 3.2, topQuartile: 5.5 },
          cacPayback: { median: 17, topQuartile: 10 },
          ruleOf40: { median: 28, topQuartile: 50 },
          magicNumber: { median: 0.6, topQuartile: 1.1 },
          grossMargin: { median: 73, topQuartile: 83 },
        },
      },
      {
        stage: "25-50M",
        label: "$25-50M ARR",
        metrics: {
          nrr: { median: 110, topQuartile: 128 },
          grr: { median: 91, topQuartile: 96 },
          logoRetention: { median: 91, topQuartile: 96 },
          growthRate: { median: 35, topQuartile: 60 },
          ltvCac: { median: 3.8, topQuartile: 6.5 },
          cacPayback: { median: 15, topQuartile: 8 },
          ruleOf40: { median: 32, topQuartile: 55 },
          magicNumber: { median: 0.65, topQuartile: 1.2 },
          grossMargin: { median: 76, topQuartile: 85 },
        },
      },
    ],
  },

  // ── KeyBanc SaaS Survey ────────────────────────────────────
  {
    source: "keybanc",
    label: "KeyBanc SaaS Survey",
    year: 2024,
    url: "https://www.key.com/kbcm/our-insights/saas-survey.html",
    stages: [
      {
        stage: "0-1M",
        label: "<$1M ARR",
        metrics: {
          nrr: { median: 89, topQuartile: 103 },
          grr: { median: 79, topQuartile: 89 },
          logoRetention: { median: 81, topQuartile: 91 },
          growthRate: { median: 85, topQuartile: 170 },
          ltvCac: { median: 1.4, topQuartile: 2.5 },
          cacPayback: { median: 30, topQuartile: 18 },
          grossMargin: { median: 63, topQuartile: 74 },
        },
      },
      {
        stage: "1-5M",
        label: "$1-5M ARR",
        metrics: {
          nrr: { median: 101, topQuartile: 114 },
          grr: { median: 86, topQuartile: 93 },
          logoRetention: { median: 86, topQuartile: 93 },
          growthRate: { median: 70, topQuartile: 130 },
          ltvCac: { median: 2.3, topQuartile: 3.5 },
          cacPayback: { median: 25, topQuartile: 15 },
          grossMargin: { median: 69, topQuartile: 79 },
        },
      },
      {
        stage: "5-10M",
        label: "$5-10M ARR",
        metrics: {
          nrr: { median: 106, topQuartile: 119 },
          grr: { median: 88, topQuartile: 94 },
          logoRetention: { median: 88, topQuartile: 94 },
          growthRate: { median: 55, topQuartile: 90 },
          ltvCac: { median: 3.0, topQuartile: 4.8 },
          cacPayback: { median: 20, topQuartile: 12 },
          ruleOf40: { median: 25, topQuartile: 48 },
          grossMargin: { median: 72, topQuartile: 81 },
        },
      },
      {
        stage: "10-25M",
        label: "$10-25M ARR",
        metrics: {
          nrr: { median: 109, topQuartile: 124 },
          grr: { median: 90, topQuartile: 95 },
          logoRetention: { median: 90, topQuartile: 96 },
          growthRate: { median: 42, topQuartile: 70 },
          ltvCac: { median: 3.4, topQuartile: 5.8 },
          cacPayback: { median: 18, topQuartile: 11 },
          ruleOf40: { median: 30, topQuartile: 52 },
          grossMargin: { median: 74, topQuartile: 84 },
        },
      },
      {
        stage: "25-50M",
        label: "$25-50M ARR",
        metrics: {
          nrr: { median: 111, topQuartile: 129 },
          grr: { median: 92, topQuartile: 97 },
          logoRetention: { median: 92, topQuartile: 97 },
          growthRate: { median: 35, topQuartile: 58 },
          ltvCac: { median: 4.0, topQuartile: 6.8 },
          cacPayback: { median: 15, topQuartile: 9 },
          ruleOf40: { median: 34, topQuartile: 58 },
          grossMargin: { median: 77, topQuartile: 86 },
        },
      },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Convert ARR (in DKK øre) to a rough USD ARR using a static DKK/USD rate,
 * then determine the appropriate benchmark stage.
 *
 * Exchange rate: 1 DKK ≈ 0.15 USD (approximate — used only for stage selection).
 */
export function detectARRStage(arrDKKOre: number): ARRStage {
  const arrUSD = (arrDKKOre / 100) * 0.15; // øre → kroner → USD

  if (arrUSD < 1_000_000) return "0-1M";
  if (arrUSD < 5_000_000) return "1-5M";
  if (arrUSD < 10_000_000) return "5-10M";
  if (arrUSD < 25_000_000) return "10-25M";
  // "25-50M" is the highest stage we hold benchmark data for, so anything above
  // is clamped to it rather than auto-selecting "50M+" (which has no dataset and
  // would strand the benchmark table on a "no data" fallback).
  return "25-50M";
}

/**
 * Get benchmarks for a specific source and ARR stage.
 *
 * Returns the benchmark stage data or null if no data exists for that combination.
 */
export function getBenchmarksForStage(
  source: BenchmarkSource,
  stage: ARRStage
): BenchmarkStage | null {
  const sourceData = BENCHMARK_DATA.find((d) => d.source === source);
  if (!sourceData) return null;
  return sourceData.stages.find((s) => s.stage === stage) ?? null;
}

/**
 * Get all benchmark sources for a given ARR stage.
 *
 * Returns an array of { source, label, benchmarks } for each source that
 * has data for the given stage.
 */
export function getAllBenchmarksForStage(
  stage: ARRStage
): { source: BenchmarkSource; label: string; benchmarks: BenchmarkStage }[] {
  const results: {
    source: BenchmarkSource;
    label: string;
    benchmarks: BenchmarkStage;
  }[] = [];

  for (const data of BENCHMARK_DATA) {
    const stageData = data.stages.find((s) => s.stage === stage);
    if (stageData) {
      results.push({
        source: data.source,
        label: data.label,
        benchmarks: stageData,
      });
    }
  }

  return results;
}

/**
 * Determine color class for a company metric compared to benchmarks.
 *
 * Returns:
 *  - "text-emerald-600" if at or above top quartile
 *  - "text-amber-600" if between median and top quartile
 *  - "text-red-600" if below median
 */
export function benchmarkColor(
  companyValue: number,
  benchmark: BenchmarkValue,
  higherIsBetter: boolean
): string {
  if (higherIsBetter) {
    if (companyValue >= benchmark.topQuartile) return "text-emerald-600";
    if (companyValue >= benchmark.median) return "text-amber-600";
    return "text-red-600";
  } else {
    // Lower is better (e.g., CAC payback, burn multiple)
    if (companyValue <= benchmark.topQuartile) return "text-emerald-600";
    if (companyValue <= benchmark.median) return "text-amber-600";
    return "text-red-600";
  }
}

/**
 * All ARR stages in order.
 */
export const ARR_STAGES: ARRStage[] = [
  "0-1M",
  "1-5M",
  "5-10M",
  "10-25M",
  "25-50M",
  "50M+",
];

/**
 * Human-readable labels for ARR stages.
 */
export const ARR_STAGE_LABELS: Record<ARRStage, string> = {
  "0-1M": "Pre-$1M ARR",
  "1-5M": "$1-5M ARR",
  "5-10M": "$5-10M ARR",
  "10-25M": "$10-25M ARR",
  "25-50M": "$25-50M ARR",
  "50M+": "$50M+ ARR",
};
