import { createClient } from "@/lib/supabase/server";
import { getTeamMemberCount } from "@/lib/clickup";
import { calculateLTV, calculateRevenuePerEmployee } from "@/lib/metrics";
import type { MRRDecomposition } from "@/lib/metrics";
import type { Currency, FXRates } from "@/lib/currency";
import type {
  ReportData,
  CohortRow,
  SegmentBreakdown,
  CustomerSummary,
  PipelineDeal,
} from "@/lib/types/report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return YYYY-MM for N months before the given month. */
function monthsAgo(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Current month as YYYY-MM. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Check whether a given YYYY-MM is the current month. */
function isCurrentMonth(month: string): boolean {
  return month === currentMonth();
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function getReportData(
  month: string,
  currency: Currency
): Promise<ReportData> {
  const supabase = await createClient();

  // Compute trailing window start (24 months back, inclusive of `month`)
  const trailingStart = monthsAgo(month, 23);

  // ------ Parallel data fetches ------------------------------------------

  const [
    snapshotRes,
    trailingRes,
    customerSnapshotsRes,
    customersRes,
    pipelineRes,
    fxRes,
  ] = await Promise.all([
    // 1. Current month snapshot
    supabase
      .from("monthly_snapshots")
      .select("*")
      .eq("month", month)
      .maybeSingle(),

    // 2. Trailing 24 months of snapshots (for history arrays)
    supabase
      .from("monthly_snapshots")
      .select("month, mrr, arr, customer_count, arpa, nrr")
      .gte("month", trailingStart)
      .lte("month", month)
      .order("month", { ascending: true }),

    // 3. Customer snapshots for the report month
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, status, plan_handle")
      .eq("month", month),

    // 4. All customers (for join / segment analysis)
    supabase.from("customers").select("*"),

    // 5. Pipeline snapshot for the month
    supabase
      .from("pipeline_snapshots")
      .select("*")
      .eq("month", month)
      .maybeSingle(),

    // 6. FX rates for the month
    supabase
      .from("fx_rates")
      .select("eur_rate, usd_rate")
      .eq("month", month)
      .maybeSingle(),
  ]);

  // ------ Unpack & default values ----------------------------------------

  const snap = snapshotRes.data;
  const trailing = trailingRes.data ?? [];
  const customerSnapshots = customerSnapshotsRes.data ?? [];
  const customers = customersRes.data ?? [];
  const pipeline = pipelineRes.data;
  const fxRow = fxRes.data;

  const fxRates: FXRates = {
    EUR: fxRow?.eur_rate ?? 0,
    USD: fxRow?.usd_rate ?? 0,
  };

  // ------ History arrays -------------------------------------------------

  const mrrHistory = trailing.map((r) => ({ month: r.month, mrr: r.mrr }));
  const arrHistory = trailing.map((r) => ({ month: r.month, arr: r.arr }));
  const countHistory = trailing.map((r) => ({
    month: r.month,
    count: r.customer_count,
  }));
  const arpaHistory = trailing.map((r) => ({ month: r.month, arpa: r.arpa }));
  const nrrHistory = trailing
    .filter((r) => r.nrr != null)
    .map((r) => ({ month: r.month, nrr: r.nrr as number }));

  // ------ Decomposition --------------------------------------------------

  const decomposition: MRRDecomposition = {
    newMRR: snap?.new_mrr ?? 0,
    expansionMRR: snap?.expansion_mrr ?? 0,
    contractionMRR: snap?.contraction_mrr ?? 0,
    churnedMRR: snap?.churned_mrr ?? 0,
    netNewMRR: snap?.net_new_mrr ?? 0,
  };

  // ------ Segment breakdown ----------------------------------------------

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const segmentAgg = new Map<
    string,
    { customerCount: number; mrr: number }
  >();
  const totalMRR = snap?.mrr ?? 0;

  for (const cs of customerSnapshots) {
    const cust = customerMap.get(cs.customer_id);
    const segment = cust?.segment ?? "Unknown";
    const existing = segmentAgg.get(segment) ?? { customerCount: 0, mrr: 0 };
    segmentAgg.set(segment, {
      customerCount: existing.customerCount + 1,
      mrr: existing.mrr + cs.mrr,
    });
  }

  const segments: SegmentBreakdown[] = Array.from(segmentAgg.entries())
    .map(([segment, data]) => ({
      segment,
      customerCount: data.customerCount,
      mrr: data.mrr,
      percentOfTotal: totalMRR > 0
        ? Math.round((data.mrr / totalMRR) * 10000) / 100
        : 0,
    }))
    .sort((a, b) => b.mrr - a.mrr);

  // ------ Top customers --------------------------------------------------

  const mapSnapshot = (cs: { customer_id: number; mrr: number; status: string; plan_handle: string | null }) => {
    const cust = customerMap.get(cs.customer_id);
    return {
      id: cs.customer_id,
      name: cust?.name ?? `Customer ${cs.customer_id}`,
      mrr: cs.mrr,
      plan: cs.plan_handle,
      status: cs.status,
      partner: cust?.partner ?? null,
      matchConfidence: cust?.match_confidence ?? "unknown",
    };
  };

  const topCustomers: CustomerSummary[] = customerSnapshots
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 20)
    .map(mapSnapshot);

  // Recently churned customers (status = churned, sorted by most recent churn date)
  const recentlyChurned: CustomerSummary[] = customers
    .filter(c => c.status === "churned" && c.churn_date)
    .sort((a, b) => (b.churn_date ?? "").localeCompare(a.churn_date ?? ""))
    .slice(0, 20)
    .map(c => ({
      id: c.id,
      name: c.name ?? c.frisbii_handle,
      mrr: 0,
      plan: c.plan_handle,
      status: "churned",
      partner: c.partner ?? null,
      matchConfidence: c.match_confidence ?? "unknown",
      churnDate: c.churn_date ?? null,
    }));

  // ------ Cohort data ----------------------------------------------------

  // Fetch all customer_snapshots across all trailing months for cohort analysis
  const cohortSnapshotsRes = await supabase
    .from("customer_snapshots")
    .select("customer_id, month, status")
    .gte("month", trailingStart)
    .lte("month", month)
    .order("month", { ascending: true });

  const cohortSnapshots = cohortSnapshotsRes.data ?? [];

  const cohortData = buildCohortData(
    cohortSnapshots,
    customers,
    trailingStart,
    month
  );

  // ------ Pipeline -------------------------------------------------------

  const deals: PipelineDeal[] = parsePipelineDeals(pipeline?.deals_json);
  const netNewMRR = snap?.net_new_mrr ?? 0;
  const weightedPipeline = pipeline?.weighted_pipeline ?? 0;
  const pipelineCoverage =
    netNewMRR !== 0
      ? Math.round((weightedPipeline / netNewMRR) * 100) / 100
      : null;

  // ------ Unit economics -------------------------------------------------

  let employeeCount: number | null = null;
  let ltv: number | null = null;
  let revenuePerEmployee: number | null = null;

  try {
    employeeCount = await getTeamMemberCount();
  } catch {
    // ClickUp may be unavailable; continue with null
  }

  const arpa = snap?.arpa ?? 0;
  const customerCount = snap?.customer_count ?? 0;

  // Derive monthly logo churn rate for LTV calculation
  if (customerCount > 0 && snap?.churned_logos != null) {
    const monthlyChurnRate =
      customerCount + snap.churned_logos > 0
        ? (snap.churned_logos / (customerCount + snap.churned_logos)) * 100
        : 0;
    if (monthlyChurnRate > 0) {
      ltv = calculateLTV(arpa, monthlyChurnRate);
    }
  }

  if (employeeCount != null && employeeCount > 0) {
    revenuePerEmployee = calculateRevenuePerEmployee(
      snap?.arr ?? 0,
      employeeCount
    );
  }

  // ------ Assemble ReportData --------------------------------------------

  return {
    month,
    currency,
    fxRates,

    revenue: {
      mrr: snap?.mrr ?? 0,
      arr: snap?.arr ?? 0,
      netNewMRR: snap?.net_new_mrr ?? 0,
      decomposition,
      nonRecurringRevenue: snap?.non_recurring_revenue ?? 0,
      mrrHistory,
      arrHistory,
      growthMoM: snap?.mrr_growth_mom ?? null,
      growthYoY: snap?.mrr_growth_yoy ?? null,
    },

    retention: {
      nrr: snap?.nrr ?? null,
      grr: snap?.grr ?? null,
      logoRetentionRate: snap?.logo_retention_rate ?? null,
      quickRatio: snap?.quick_ratio ?? null,
      cohortData,
      nrrHistory,
    },

    customers: {
      count: snap?.customer_count ?? 0,
      newLogos: snap?.new_logos ?? 0,
      churnedLogos: snap?.churned_logos ?? 0,
      arpa: snap?.arpa ?? 0,
      top10Concentration: snap?.top10_concentration ?? null,
      segments,
      topCustomers,
      recentlyChurned,
      countHistory,
      arpaHistory,
    },

    pipeline: {
      totalPipelineValue: pipeline?.total_pipeline_value ?? 0,
      weightedPipeline: pipeline?.weighted_pipeline ?? 0,
      pipelineCoverage,
      dealsWon: pipeline?.deals_won ?? 0,
      dealsLost: pipeline?.deals_lost ?? 0,
      dealsOpen: pipeline?.deals_open ?? 0,
      winRate: pipeline?.win_rate ?? null,
      avgSalesCycleDays: pipeline?.avg_sales_cycle_days ?? 0,
      avgDealSize: pipeline?.avg_deal_size ?? 0,
      deals,
    },

    unitEconomics: {
      ltv,
      revenuePerEmployee,
      employeeCount,
      cac: null,
      ltvCacRatio: null,
      grossMargin: null,
      ruleOf40: null,
    },

    commentary: {
      executiveSummary: snap?.executive_summary ?? null,
      highlights: snap?.highlights ?? null,
      lowlights: snap?.lowlights ?? null,
      whatsAhead: snap?.whats_ahead ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Cohort builder
// ---------------------------------------------------------------------------

function buildCohortData(
  snapshots: { customer_id: number; month: string; status: string }[],
  customers: { id: number; start_date: string | null }[],
  _trailingStart: string,
  _endMonth: string
): CohortRow[] {
  // Group customers by their cohort month (start_date truncated to YYYY-MM)
  const customerCohort = new Map<number, string>();
  for (const c of customers) {
    if (c.start_date) {
      customerCohort.set(c.id, c.start_date.substring(0, 7));
    }
  }

  // Group snapshots by customer_id
  const snapshotsByCustomer = new Map<number, Map<string, string>>();
  for (const s of snapshots) {
    if (!snapshotsByCustomer.has(s.customer_id)) {
      snapshotsByCustomer.set(s.customer_id, new Map());
    }
    snapshotsByCustomer.get(s.customer_id)!.set(s.month, s.status);
  }

  // Collect all unique months in the snapshot data, sorted
  const allMonths = [
    ...new Set(snapshots.map((s) => s.month)),
  ].sort();

  // Build cohort rows: group by cohort month
  const cohortGroups = new Map<string, Set<number>>();
  for (const [custId, cohortMonth] of customerCohort) {
    if (!cohortGroups.has(cohortMonth)) {
      cohortGroups.set(cohortMonth, new Set());
    }
    cohortGroups.get(cohortMonth)!.add(custId);
  }

  const cohortRows: CohortRow[] = [];

  for (const [cohortMonth, customerIds] of Array.from(cohortGroups.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  )) {
    const startCount = customerIds.size;
    if (startCount === 0) continue;

    // For each subsequent month, count how many of these customers are still active
    const retentionByMonth: { month: string; retainedPercent: number }[] = [];

    for (const m of allMonths) {
      if (m < cohortMonth) continue;

      let retained = 0;
      for (const custId of customerIds) {
        const custSnapshots = snapshotsByCustomer.get(custId);
        if (!custSnapshots) continue;
        const status = custSnapshots.get(m);
        if (status && status === "active") {
          retained++;
        }
      }

      retentionByMonth.push({
        month: m,
        retainedPercent:
          Math.round((retained / startCount) * 10000) / 100,
      });
    }

    cohortRows.push({
      cohortMonth,
      startCount,
      retentionByMonth,
    });
  }

  return cohortRows;
}

// ---------------------------------------------------------------------------
// Pipeline deals parser
// ---------------------------------------------------------------------------

function parsePipelineDeals(dealsJson: unknown): PipelineDeal[] {
  if (!dealsJson || !Array.isArray(dealsJson)) return [];

  return dealsJson.map((d: Record<string, unknown>) => ({
    id: String(d.id ?? ""),
    name: String(d.name ?? ""),
    // deals_json stores amount as whole DKK (e.g. "50000"); convert to øre
    amount: Math.round(Number(d.amount ?? 0) * 100),
    stage: String(d.stage_label ?? d.stage ?? ""),
    probability: Number(d.probability ?? 0),
    closeDate: d.closedate != null ? String(d.closedate) : null,
    daysToClose: d.days_to_close != null ? Number(d.days_to_close) : null,
    createDate: String(d.createDate ?? ""),
  }));
}
