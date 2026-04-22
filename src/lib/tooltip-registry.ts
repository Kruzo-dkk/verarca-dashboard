/**
 * Centralized tooltip content for every metric in the dashboard.
 *
 * Each entry maps a metric key to its human-readable name, calculation
 * formula, data source, and an optional SaaS benchmark.
 */

export interface TooltipContent {
  name: string;
  formula: string;
  source: string;
  benchmark?: string;
}

export type MetricKey =
  // Hero KPIs
  | "arr"
  | "mrr"
  | "netNewMRR"
  | "nrr"
  | "activeCustomers"
  | "quickRatio"
  // Revenue
  | "newMRR"
  | "expansionMRR"
  | "contractionMRR"
  | "churnedMRR"
  | "momGrowth"
  | "yoyGrowth"
  | "nonRecurring"
  // Committed MRR
  | "billedMRR"
  | "discountDelta"
  | "discountExpirations"
  // Retention
  | "grr"
  | "logoRetentionRate"
  | "logoChurnRate"
  | "revenueChurnRate"
  | "cohortRetention"
  // Pipeline
  | "pipelineValue"
  | "weightedPipeline"
  | "winRate"
  | "pipelineCoverage"
  | "avgDealSize"
  | "avgSalesCycle"
  // Customers
  | "customerCount"
  | "newLogos"
  | "churnedLogos"
  | "arpa"
  | "top10Concentration"
  // Unit Economics
  | "ltv"
  | "revenuePerEmployee"
  | "cac"
  | "ltvCacRatio"
  | "grossMargin"
  | "ruleOf40";

export const tooltipRegistry: Record<MetricKey, TooltipContent> = {
  // ---------------------------------------------------------------------------
  // Hero KPIs
  // ---------------------------------------------------------------------------
  arr: {
    name: "Annual Recurring Revenue",
    formula: "MRR × 12",
    source: "Frisbii subscriptions",
    benchmark: "N/A — depends on stage",
  },
  mrr: {
    name: "Monthly Recurring Revenue",
    formula: "Sum of (plan list price × qty + add-ons) for all active subscriptions",
    source: "Frisbii subscriptions",
  },
  netNewMRR: {
    name: "Net New MRR",
    formula: "New MRR + Expansion − Contraction − Churned MRR",
    source: "Monthly snapshots",
  },
  nrr: {
    name: "Net Revenue Retention",
    formula: "(End MRR from existing customers / Start MRR) × 100",
    source: "Customer snapshots",
    benchmark: "Best-in-class: >120%",
  },
  activeCustomers: {
    name: "Active Customers",
    formula: "Count of customers with status = active",
    source: "Frisbii subscriptions",
  },
  quickRatio: {
    name: "Quick Ratio",
    formula: "(New MRR + Expansion MRR) / (Contraction MRR + Churned MRR)",
    source: "Monthly snapshots",
    benchmark: ">4 excellent, >2 good, <1 shrinking",
  },

  // ---------------------------------------------------------------------------
  // Revenue decomposition
  // ---------------------------------------------------------------------------
  newMRR: {
    name: "New MRR",
    formula: "MRR from subscriptions that started this month",
    source: "Customer snapshots (new status)",
  },
  expansionMRR: {
    name: "Expansion MRR",
    formula: "MRR increase from existing customers (upgrades/add-ons)",
    source: "Customer snapshots (MRR delta > 0)",
  },
  contractionMRR: {
    name: "Contraction MRR",
    formula: "MRR decrease from existing customers (downgrades)",
    source: "Customer snapshots (MRR delta < 0)",
  },
  churnedMRR: {
    name: "Churned MRR",
    formula: "MRR lost from customers who cancelled",
    source: "Customer snapshots (churned status)",
    benchmark: "Excludes customers who churned before their first Frisbii invoice (kr 0 MRR) — those count toward logo churn only.",
  },
  momGrowth: {
    name: "Month-over-Month Growth",
    formula: "((Current MRR − Previous MRR) / Previous MRR) × 100",
    source: "Monthly snapshots",
    benchmark: ">5% early stage, >2% growth stage",
  },
  yoyGrowth: {
    name: "Year-over-Year Growth",
    formula: "((Current MRR − MRR 12 months ago) / MRR 12 months ago) × 100",
    source: "Monthly snapshots",
    benchmark: ">100% early, >50% growth, >25% at scale",
  },
  nonRecurring: {
    name: "Non-Recurring Revenue",
    formula: "One-time fees (setup, onboarding, consulting)",
    source: "Monthly snapshots",
  },

  // ---------------------------------------------------------------------------
  // Committed MRR
  // ---------------------------------------------------------------------------
  billedMRR: {
    name: "Billed MRR",
    formula: "List Price MRR − Total active discount impacts",
    source: "Frisbii subscriptions + discount snapshots",
    benchmark: "Gap should narrow as discounts expire",
  },
  discountDelta: {
    name: "Discount Delta",
    formula: "List Price MRR − Billed MRR (total monthly discount impact)",
    source: "Discount snapshots",
  },
  discountExpirations: {
    name: "Upcoming Discount Expirations",
    formula: "Sum of monthly impacts grouped by discount expiration month",
    source: "Discount snapshots (expires_at field)",
  },

  // ---------------------------------------------------------------------------
  // Retention
  // ---------------------------------------------------------------------------
  grr: {
    name: "Gross Revenue Retention",
    formula: "(End MRR − Expansion MRR) / Start MRR × 100",
    source: "Monthly snapshots",
    benchmark: "Best-in-class: >90%",
  },
  logoRetentionRate: {
    name: "Logo Retention Rate",
    formula: "(Active customers at end / Active at start) × 100",
    source: "Customer snapshots",
    benchmark: "Target: >90%",
  },
  logoChurnRate: {
    name: "Logo Churn Rate",
    formula: "(Churned logos / Active customers at start) × 100",
    source: "Monthly snapshots",
    benchmark: "Target: <10% (i.e. >90% logo retention). Counts all lost customers, including those who churned before receiving their first invoice.",
  },
  revenueChurnRate: {
    name: "Revenue Churn Rate",
    formula: "(Churned MRR / Start MRR) × 100",
    source: "Monthly snapshots",
    benchmark: "Target: <5%. Only counts MRR actually lost — a customer who churned before their first invoice contributes 0 here but still counts toward logo churn.",
  },
  cohortRetention: {
    name: "Cohort Retention",
    formula: "% of customers from each cohort still active in subsequent months",
    source: "Customer snapshots by start_date",
  },

  // ---------------------------------------------------------------------------
  // Pipeline
  // ---------------------------------------------------------------------------
  pipelineValue: {
    name: "Total Pipeline Value",
    formula: "Sum of deal amounts across all open deals",
    source: "HubSpot CRM",
  },
  weightedPipeline: {
    name: "Weighted Pipeline",
    formula: "Sum of (deal amount × probability) for all open deals",
    source: "HubSpot CRM",
  },
  winRate: {
    name: "Win Rate",
    formula: "Deals won / (Deals won + Deals lost) × 100",
    source: "HubSpot CRM",
    benchmark: ">25% good, >40% excellent",
  },
  pipelineCoverage: {
    name: "Pipeline Coverage",
    formula: "Weighted pipeline / Net New MRR",
    source: "HubSpot + Frisbii",
    benchmark: ">3x healthy, >5x conservative",
  },
  avgDealSize: {
    name: "Average Deal Size",
    formula: "Sum of won deal amounts / Number of won deals",
    source: "HubSpot CRM",
  },
  avgSalesCycle: {
    name: "Average Sales Cycle",
    formula: "Mean days from deal creation to close (won deals only)",
    source: "HubSpot CRM",
  },

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------
  customerCount: {
    name: "Total Active Customers",
    formula: "Count of subscriptions with status = active",
    source: "Frisbii subscriptions",
  },
  newLogos: {
    name: "New Logos",
    formula: "Customers whose subscription started this month",
    source: "Customer snapshots",
  },
  churnedLogos: {
    name: "Churned Logos",
    formula: "Customers who cancelled this month",
    source: "Customer snapshots",
    benchmark: "Includes customers who churned before their first Frisbii invoice (kr 0 MRR) — these affect logo churn but not revenue churn.",
  },
  arpa: {
    name: "Average Revenue Per Account",
    formula: "MRR / Active customer count",
    source: "Monthly snapshots",
  },
  top10Concentration: {
    name: "Top 10 Revenue Concentration",
    formula: "MRR of top 10 customers / Total MRR × 100",
    source: "Customer snapshots",
    benchmark: "<30% healthy, >50% risky",
  },

  // ---------------------------------------------------------------------------
  // Unit Economics
  // ---------------------------------------------------------------------------
  ltv: {
    name: "Customer Lifetime Value",
    formula: "ARPA / Monthly logo churn rate",
    source: "Calculated from Frisbii data",
  },
  revenuePerEmployee: {
    name: "Revenue per Employee",
    formula: "ARR / Employee count",
    source: "ClickUp team members",
    benchmark: ">$100k early, >$200k growth",
  },
  cac: {
    name: "Customer Acquisition Cost",
    formula: "Total monthly spend (marketing + sales) / New logos",
    source: "Settings (manual input)",
  },
  ltvCacRatio: {
    name: "LTV/CAC Ratio",
    formula: "Customer LTV / CAC",
    source: "Calculated",
    benchmark: ">3x healthy, >5x excellent",
  },
  grossMargin: {
    name: "Gross Margin",
    formula: "(Revenue − COGS) / Revenue × 100",
    source: "Not yet integrated",
    benchmark: ">70% SaaS benchmark",
  },
  ruleOf40: {
    name: "Rule of 40",
    formula: "Revenue growth rate (%) + Profit margin (%)",
    source: "Not yet integrated",
    benchmark: ">40% is excellent",
  },
};
