import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHealthScore } from "@/lib/health-score";
import { inferTierFromPlan, inferScopeFromPlan } from "@/lib/format-plan-name";
import type {
  CSDashboardData,
  CSCustomer,
  TierBreakdown,
  HealthDistribution,
  SupportMetrics,
  ManagedPerformance,
  OnboardingData,
} from "@/lib/types/cs";

function monthsDiff(startDate: string | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  return (
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  );
}

/** Return YYYY-MM for N months before the given YYYY-MM */
function subtractMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    searchParams.get("month") ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const prevMonth = subtractMonths(month, 1);
  const sixMonthsAgo = subtractMonths(month, 6);

  const admin = createAdminClient();

  // ── Fetch all data in parallel ────────────────────────────────
  const [customersRes, snapshotsRes, ticketsCurrentRes, ticketsPrevRes, activityRes] =
    await Promise.all([
      admin
        .from("customers")
        .select(
          "id, name, status, plan_handle, segment, start_date, tier_override, scope_override, hubspot_company_id"
        )
        .eq("status", "active"),
      admin
        .from("customer_snapshots")
        .select("customer_id, month, mrr")
        .gte("month", sixMonthsAgo)
        .lte("month", month),
      admin.from("ticket_snapshots").select("*").eq("month", month),
      admin.from("ticket_snapshots").select("*").eq("month", prevMonth),
      admin
        .from("activity_snapshots")
        .select("date")
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`),
    ]);

  const customers = customersRes.data ?? [];
  const snapshots = snapshotsRes.data ?? [];
  const ticketsCurrent = ticketsCurrentRes.data ?? [];
  const ticketsPrev = ticketsPrevRes.data ?? [];

  // ── Index snapshots by customer ───────────────────────────────
  const snapshotsByCustomer = new Map<
    number,
    { month: string; mrr: number }[]
  >();
  for (const s of snapshots) {
    const list = snapshotsByCustomer.get(s.customer_id) ?? [];
    list.push({ month: s.month, mrr: s.mrr });
    snapshotsByCustomer.set(s.customer_id, list);
  }

  // ── Index tickets by customer ─────────────────────────────────
  const ticketsByCustomer = new Map<
    number,
    (typeof ticketsCurrent)[number][]
  >();
  for (const t of ticketsCurrent) {
    if (t.customer_id == null) continue;
    const list = ticketsByCustomer.get(t.customer_id) ?? [];
    list.push(t);
    ticketsByCustomer.set(t.customer_id, list);
  }

  // ── Build per-customer data ───────────────────────────────────
  const healthCounts: HealthDistribution = {
    healthy: 0,
    neutral: 0,
    atRisk: 0,
  };

  const tierCounts = { managed: { count: 0, mrr: 0 }, standard: { count: 0, mrr: 0 }, unassigned: { count: 0, mrr: 0 } };

  const csCustomers: CSCustomer[] = [];
  const managedMrrs: number[] = [];
  const standardMrrs: number[] = [];

  for (const customer of customers) {
    const tier =
      customer.tier_override ?? inferTierFromPlan(customer.plan_handle);
    const scope =
      customer.scope_override ?? inferScopeFromPlan(customer.plan_handle);

    // MRR history (newest first)
    const mrrHistory = (snapshotsByCustomer.get(customer.id) ?? [])
      .sort((a, b) => b.month.localeCompare(a.month));

    const currentMrr = mrrHistory[0]?.mrr ?? 0;

    // MRR trend: current vs 3 months ago
    const threeMonthsAgo = subtractMonths(month, 3);
    const oldSnap = mrrHistory.find((s) => s.month <= threeMonthsAgo);
    let mrrTrend: CSCustomer["mrrTrend"] = "flat";
    if (oldSnap && oldSnap.mrr > 0) {
      const change = (currentMrr - oldSnap.mrr) / oldSnap.mrr;
      if (change > 0.05) mrrTrend = "expanding";
      else if (change < -0.05) mrrTrend = "contracting";
    }

    const monthsAsCustomer = monthsDiff(customer.start_date);

    // daysSinceLastActivity: null for now (activities are per-owner, not per-customer)
    const daysSinceLastActivity: number | null = null;

    // Open tickets
    const customerTickets = ticketsByCustomer.get(customer.id) ?? [];
    const openTickets = customerTickets.filter(
      (t) => t.status !== "closed" && t.status !== "Closed"
    ).length;

    // Health score
    const health = computeHealthScore({
      mrrHistory,
      tier,
      monthsAsCustomer,
      daysSinceLastActivity,
      openTickets,
    });

    // Accumulate tier breakdown
    const tierKey =
      tier === "Managed"
        ? "managed"
        : tier === "Standard"
          ? "standard"
          : "unassigned";
    tierCounts[tierKey].count += 1;
    tierCounts[tierKey].mrr += currentMrr;

    // Accumulate health distribution
    healthCounts[health.label === "at_risk" ? "atRisk" : health.label] += 1;

    // Accumulate per-tier MRR for managed performance
    if (tier === "Managed") managedMrrs.push(currentMrr);
    else if (tier === "Standard") standardMrrs.push(currentMrr);

    csCustomers.push({
      id: customer.id,
      name: customer.name,
      tier,
      scope,
      mrr: currentMrr,
      mrrTrend,
      healthScore: health.score,
      healthLabel: health.label,
      healthFactors: health.factors,
      startDate: customer.start_date,
      openTickets,
      daysSinceLastActivity,
    });
  }

  // ── Tier breakdown ────────────────────────────────────────────
  const totalCustomers = customers.length || 1;
  const tierBreakdown: TierBreakdown = {
    managed: {
      ...tierCounts.managed,
      percentOfTotal: Math.round(
        (tierCounts.managed.count / totalCustomers) * 100
      ),
    },
    standard: {
      ...tierCounts.standard,
      percentOfTotal: Math.round(
        (tierCounts.standard.count / totalCustomers) * 100
      ),
    },
    unassigned: {
      ...tierCounts.unassigned,
      percentOfTotal: Math.round(
        (tierCounts.unassigned.count / totalCustomers) * 100
      ),
    },
  };

  // ── Support metrics ───────────────────────────────────────────
  const allOpenTickets = ticketsCurrent.filter(
    (t) => t.status !== "closed" && t.status !== "Closed"
  ).length;

  const resolvedTickets = ticketsCurrent.filter(
    (t) => t.resolution_time_hours != null
  );
  const avgResolutionHours =
    resolvedTickets.length > 0
      ? Math.round(
          resolvedTickets.reduce(
            (sum, t) => sum + (t.resolution_time_hours ?? 0),
            0
          ) / resolvedTickets.length
        )
      : null;

  const ticketsThisMonth = ticketsCurrent.length;
  const ticketsLastMonth = ticketsPrev.length;
  const ticketTrend =
    ticketsLastMonth > 0
      ? Math.round(
          ((ticketsThisMonth - ticketsLastMonth) / ticketsLastMonth) * 100
        )
      : 0;

  const supportMetrics: SupportMetrics = {
    openTickets: allOpenTickets,
    avgResolutionHours,
    ticketsThisMonth,
    ticketsLastMonth,
    ticketTrend,
  };

  // ── At-risk customers (sorted by score ascending) ─────────────
  const atRiskCustomers = csCustomers
    .filter((c) => c.healthLabel === "at_risk")
    .sort((a, b) => a.healthScore - b.healthScore);

  // ── Managed performance ───────────────────────────────────────
  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
      : 0;

  const managedPerformance: ManagedPerformance = {
    managedRetentionRate: null, // requires churn data over time
    standardRetentionRate: null,
    managedAvgMRR: avg(managedMrrs),
    standardAvgMRR: avg(standardMrrs),
    managedGrowthRate: null, // requires multi-month comparison
    standardGrowthRate: null,
  };

  // ── Onboarding (placeholder) ──────────────────────────────────
  const onboarding: OnboardingData = {
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    avgDaysToOnboard: null,
    customers: [],
  };

  // ── Response ──────────────────────────────────────────────────
  const data: CSDashboardData = {
    month,
    tierBreakdown,
    onboarding,
    healthDistribution: healthCounts,
    supportMetrics,
    atRiskCustomers,
    managedPerformance,
  };

  return NextResponse.json(data);
}
