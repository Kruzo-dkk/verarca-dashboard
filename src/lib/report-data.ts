import { createClient } from "@/lib/supabase/server";
import { getTeamMemberCount } from "@/lib/clickup";
import { calculateLTV, calculateRevenuePerEmployee } from "@/lib/metrics";
import { computeCommittedMRR } from "@/lib/committed-mrr";
import type { MRRDecomposition } from "@/lib/metrics";
import type { Currency, FXRates } from "@/lib/currency";
import type {
  ReportData,
  CohortRow,
  SegmentBreakdown,
  CustomerSummary,
  PipelineDeal,
  ChannelMetrics,
  PartnerMetrics,
  LeadSource,
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

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

/**
 * Fetch and aggregate report data for a given period.
 *
 * When startMonth === endMonth: identical to single-month behaviour.
 * When startMonth < endMonth (range query):
 *   - Point-in-time metrics (MRR, ARR, count, NRR, etc.): uses endMonth values
 *   - Flow metrics (net new, decomposition, new/churned logos): summed across range
 */
export async function getReportData(
  startMonth: string,
  endMonth: string,
  currency: Currency
): Promise<ReportData> {
  const supabase = await createClient();
  const isRange = startMonth !== endMonth;

  // Compute trailing window start (24 months back from endMonth)
  const trailingStart = monthsAgo(endMonth, 23);

  // ------ Parallel data fetches ------------------------------------------

  const [
    endSnapshotRes,
    rangeSnapshotsRes,
    trailingRes,
    customerSnapshotsRes,
    customersRes,
    pipelineRes,
    fxRes,
    settingsRes,
    discountSnapshotsRes,
    channelMetricsRes,
  ] = await Promise.all([
    // 1. End-month snapshot (point-in-time metrics)
    supabase
      .from("monthly_snapshots")
      .select("*")
      .eq("month", endMonth)
      .maybeSingle(),

    // 2. Range snapshots (for summing flow metrics across multi-month periods)
    isRange
      ? supabase
          .from("monthly_snapshots")
          .select("*")
          .gte("month", startMonth)
          .lte("month", endMonth)
          .order("month", { ascending: true })
      : Promise.resolve({ data: null, error: null }),

    // 3. Trailing 24 months of snapshots (for history arrays)
    supabase
      .from("monthly_snapshots")
      .select("month, mrr, arr, customer_count, arpa, nrr")
      .gte("month", trailingStart)
      .lte("month", endMonth)
      .order("month", { ascending: true }),

    // 4. Customer snapshots for the end month
    supabase
      .from("customer_snapshots")
      .select("customer_id, mrr, status, plan_handle, plan_name")
      .eq("month", endMonth),

    // 5. All customers (for join / segment analysis)
    supabase.from("customers").select("*"),

    // 6. Pipeline snapshot for the end month
    supabase
      .from("pipeline_snapshots")
      .select("*")
      .eq("month", endMonth)
      .maybeSingle(),

    // 7. FX rates for the end month
    supabase
      .from("fx_rates")
      .select("eur_rate, usd_rate")
      .eq("month", endMonth)
      .maybeSingle(),

    // 8. Settings for the end month (CAC spend, employee override)
    supabase
      .from("settings")
      .select("total_cac, employee_count")
      .eq("month", endMonth)
      .maybeSingle(),

    // 9. Discount snapshots for the end month (committed MRR)
    supabase
      .from("discount_snapshots")
      .select("monthly_impact, discount_name, discount_percentage, discount_type, expires_at, subscription_handle, customer_id")
      .eq("month", endMonth),

    // 10. Channel metrics for the end month
    supabase
      .from("channel_metrics")
      .select("*")
      .eq("month", endMonth),
  ]);

  // ------ Unpack & default values ----------------------------------------

  const snap = endSnapshotRes.data;
  const rangeSnaps = rangeSnapshotsRes.data ?? [];
  const trailing = trailingRes.data ?? [];
  const customerSnapshots = customerSnapshotsRes.data ?? [];
  const customers = customersRes.data ?? [];
  const pipeline = pipelineRes.data;
  const fxRow = fxRes.data;
  const settingsRow = settingsRes.data;
  const discountSnapshots = discountSnapshotsRes.data ?? [];
  const channelMetricsRows = channelMetricsRes.data ?? [];

  const fxRates: FXRates = {
    EUR: fxRow?.eur_rate ?? 0,
    USD: fxRow?.usd_rate ?? 0,
  };

  // ------ History arrays -------------------------------------------------

  // Only include months that have real data — trim leading zero/null entries
  // so charts start from the first month with actual revenue.
  const firstValidIdx = trailing.findIndex((r) => r.mrr > 0 || r.arr > 0);
  const validTrailing = firstValidIdx >= 0 ? trailing.slice(firstValidIdx) : [];

  const mrrHistory = validTrailing.map((r) => ({ month: r.month, mrr: r.mrr }));
  const arrHistory = validTrailing.map((r) => ({ month: r.month, arr: r.arr }));
  const countHistory = validTrailing.map((r) => ({
    month: r.month,
    count: r.customer_count,
  }));
  const arpaHistory = validTrailing.map((r) => ({
    month: r.month,
    arpa: r.arpa,
  }));
  const nrrHistory = validTrailing
    .filter((r) => r.nrr != null)
    .map((r) => ({ month: r.month, nrr: r.nrr as number }));

  // ------ Decomposition (flow metrics: sum across range) -----------------

  let decomposition: MRRDecomposition;
  let totalNetNewMRR: number;
  let totalNewLogos: number;
  let totalChurnedLogos: number;
  let totalNonRecurring: number;

  if (isRange && rangeSnaps.length > 0) {
    // Sum flow metrics across all months in the range
    decomposition = {
      newMRR: sumField(rangeSnaps, "new_mrr"),
      expansionMRR: sumField(rangeSnaps, "expansion_mrr"),
      contractionMRR: sumField(rangeSnaps, "contraction_mrr"),
      churnedMRR: sumField(rangeSnaps, "churned_mrr"),
      netNewMRR: sumField(rangeSnaps, "net_new_mrr"),
    };
    totalNetNewMRR = decomposition.netNewMRR;
    totalNewLogos = sumField(rangeSnaps, "new_logos");
    totalChurnedLogos = sumField(rangeSnaps, "churned_logos");
    totalNonRecurring = sumField(rangeSnaps, "non_recurring_revenue");
  } else {
    // Single month
    decomposition = {
      newMRR: snap?.new_mrr ?? 0,
      expansionMRR: snap?.expansion_mrr ?? 0,
      contractionMRR: snap?.contraction_mrr ?? 0,
      churnedMRR: snap?.churned_mrr ?? 0,
      netNewMRR: snap?.net_new_mrr ?? 0,
    };
    totalNetNewMRR = snap?.net_new_mrr ?? 0;
    totalNewLogos = snap?.new_logos ?? 0;
    totalChurnedLogos = snap?.churned_logos ?? 0;
    totalNonRecurring = snap?.non_recurring_revenue ?? 0;
  }

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

  const mapSnapshot = (cs: { customer_id: number; mrr: number; status: string; plan_handle: string | null; plan_name?: string | null }) => {
    const cust = customerMap.get(cs.customer_id);
    return {
      id: cs.customer_id,
      name: cust?.name ?? `Customer ${cs.customer_id}`,
      mrr: cs.mrr,
      plan: cs.plan_name ?? cust?.plan_name ?? cs.plan_handle,
      status: cs.status,
      partner: cust?.partner ?? null,
      segment: cust?.segment ?? null,
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
      plan: c.plan_name ?? c.plan_handle,
      status: "churned",
      partner: c.partner ?? null,
      segment: c.segment ?? null,
      matchConfidence: c.match_confidence ?? "unknown",
      churnDate: c.churn_date ?? null,
    }));

  // ------ Cohort data ----------------------------------------------------

  const cohortSnapshotsRes = await supabase
    .from("customer_snapshots")
    .select("customer_id, month, status")
    .gte("month", trailingStart)
    .lte("month", endMonth)
    .order("month", { ascending: true });

  const cohortSnapshots = cohortSnapshotsRes.data ?? [];

  const cohortData = buildCohortData(
    cohortSnapshots,
    customers,
    trailingStart,
    endMonth
  );

  // ------ Pipeline -------------------------------------------------------

  const deals: PipelineDeal[] = parsePipelineDeals(pipeline?.deals_json);
  const weightedPipeline = pipeline?.weighted_pipeline ?? 0;
  const pipelineCoverage =
    totalNetNewMRR !== 0
      ? Math.round((weightedPipeline / totalNetNewMRR) * 100) / 100
      : null;

  // ------ Unit economics -------------------------------------------------

  let employeeCount: number | null = null;
  let ltv: number | null = null;
  let revenuePerEmployee: number | null = null;
  let cac: number | null = null;
  let ltvCacRatio: number | null = null;

  // Employee count: settings override takes precedence over ClickUp
  if (settingsRow?.employee_count != null) {
    employeeCount = settingsRow.employee_count;
  } else {
    try {
      employeeCount = await getTeamMemberCount();
    } catch {
      // ClickUp may be unavailable; continue with null
    }
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

  // CAC: total S&M spend / new logos (both must be > 0)
  const totalCacSpend = settingsRow?.total_cac ?? 0;
  if (totalCacSpend > 0 && totalNewLogos > 0) {
    cac = Math.round(totalCacSpend / totalNewLogos);
  }

  // LTV/CAC ratio (both must be available)
  if (ltv !== null && cac !== null && cac > 0) {
    ltvCacRatio = Math.round((ltv / cac) * 100) / 100;
  }

  // ------ Channel attribution ----------------------------------------------

  const byChannel: ChannelMetrics[] = channelMetricsRows.map((row) => ({
    channel: row.channel as LeadSource,
    newLogos: row.new_logos ?? 0,
    newMRR: row.new_mrr ?? 0,
    pipelineValue: row.pipeline_value,
    dealsCreated: row.deals_created,
    dealsWon: row.deals_won,
    dealsLost: row.deals_lost,
    winRate: row.win_rate,
    avgDealSize: row.avg_deal_size,
    avgSalesCycleDays: row.avg_sales_cycle_days,
    cac: row.cac,
  }));

  // Partner performance: group active customers by partner name
  const partnerAgg = new Map<
    string,
    { customerCount: number; totalMRR: number; newLogos: number }
  >();

  const monthStart = `${endMonth}-01`;
  const [endY, endM] = endMonth.split("-").map(Number);
  const endLastDay = new Date(endY, endM, 0).getDate();
  const monthEnd = `${endMonth}-${String(endLastDay).padStart(2, "0")}`;

  for (const cs of customerSnapshots) {
    if (cs.status !== "active") continue;
    const cust = customerMap.get(cs.customer_id);
    if (!cust?.partner) continue;

    const existing = partnerAgg.get(cust.partner) ?? {
      customerCount: 0,
      totalMRR: 0,
      newLogos: 0,
    };

    existing.customerCount += 1;
    existing.totalMRR += cs.mrr;

    // Check if this is a new logo in the target month
    const startDate = cust.start_date?.slice(0, 10);
    if (startDate && startDate >= monthStart && startDate <= monthEnd) {
      existing.newLogos += 1;
    }

    partnerAgg.set(cust.partner, existing);
  }

  const byPartner: PartnerMetrics[] = Array.from(partnerAgg.entries())
    .map(([partner, data]) => ({
      partner,
      customerCount: data.customerCount,
      totalMRR: data.totalMRR,
      avgMRR: data.customerCount > 0 ? Math.round(data.totalMRR / data.customerCount) : 0,
      newLogos: data.newLogos,
    }))
    .sort((a, b) => b.totalMRR - a.totalMRR);

  // ------ Committed MRR ---------------------------------------------------

  const committedMRR =
    discountSnapshots.length > 0
      ? computeCommittedMRR(snap?.mrr ?? 0, discountSnapshots)
      : null;

  // ------ Assemble ReportData --------------------------------------------

  return {
    month: endMonth,
    currency,
    fxRates,

    revenue: {
      mrr: snap?.mrr ?? 0,
      arr: snap?.arr ?? 0,
      netNewMRR: totalNetNewMRR,
      decomposition,
      nonRecurringRevenue: totalNonRecurring,
      mrrHistory,
      arrHistory,
      growthMoM: snap?.mrr_growth_mom ?? null,
      growthYoY: snap?.mrr_growth_yoy ?? null,
      committedMRR,
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
      newLogos: totalNewLogos,
      churnedLogos: totalChurnedLogos,
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

    channels: {
      byChannel,
      byPartner,
    },

    unitEconomics: {
      ltv,
      revenuePerEmployee,
      employeeCount,
      cac,
      ltvCacRatio,
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
// Helpers
// ---------------------------------------------------------------------------

/** Sum a numeric field across an array of snapshot rows. */
function sumField(
  rows: Record<string, unknown>[],
  field: string
): number {
  return rows.reduce(
    (acc, row) => acc + (typeof row[field] === "number" ? (row[field] as number) : 0),
    0
  );
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
