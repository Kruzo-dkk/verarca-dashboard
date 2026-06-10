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
  // (activity_snapshots is intentionally NOT fetched here: it's per-owner, not
  // per-customer, so it can't drive per-customer health — the previous query
  // was discarded AND crashed on 30-day months via a `${month}-31` date bound.)
  const [customersRes, snapshotsRes, ticketsCurrentRes, ticketsPrevRes] =
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

  // Per-tier aggregates over the snapshot window (current vs 3 months ago) for
  // the Managed-vs-Standard Growth Rate and Retention Rate rows.
  const tierAgg: Record<
    "Managed" | "Standard",
    { nowMrr: number; thenMrr: number; payingThen: number; retained: number }
  > = {
    Managed: { nowMrr: 0, thenMrr: 0, payingThen: 0, retained: 0 },
    Standard: { nowMrr: 0, thenMrr: 0, payingThen: 0, retained: 0 },
  };

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

    // Per-tier growth/retention vs 3 months ago (data exists in the window).
    if (tier === "Managed" || tier === "Standard") {
      const agg = tierAgg[tier];
      const thenMrr = oldSnap?.mrr ?? 0;
      agg.nowMrr += currentMrr;
      agg.thenMrr += thenMrr;
      if (thenMrr > 0) {
        agg.payingThen += 1;
        if (currentMrr > 0) agg.retained += 1;
      }
    }

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
  // null when there's no basis to compare (no tickets last month) so the UI can
  // show "N/A" instead of a misleading 0% — important while ticket data is
  // scope-blocked and both months are empty.
  const ticketTrend =
    ticketsLastMonth > 0
      ? Math.round(
          ((ticketsThisMonth - ticketsLastMonth) / ticketsLastMonth) * 100
        )
      : null;

  const supportMetrics: SupportMetrics = {
    openTickets: allOpenTickets,
    avgResolutionHours,
    ticketsThisMonth,
    ticketsLastMonth,
    ticketTrend,
  };

  // Surface known data gaps so the dashboard doesn't present empty/partial data
  // as real. Tickets require a HubSpot scope not granted in production, so
  // `ticket_snapshots` is empty — health scores then omit the support signal.
  const dataWarnings: string[] = [];
  if (ticketsCurrent.length === 0 && ticketsPrev.length === 0) {
    dataWarnings.push("tickets_unavailable");
  }

  // ── At-risk customers (sorted by score ascending) ─────────────
  const atRiskCustomers = csCustomers
    .filter((c) => c.healthLabel === "at_risk")
    .sort((a, b) => a.healthScore - b.healthScore);

  // ── Managed performance ───────────────────────────────────────
  const avg = (arr: number[]) =>
    arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
      : 0;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const growthOf = (t: "Managed" | "Standard") =>
    tierAgg[t].thenMrr > 0
      ? round1(((tierAgg[t].nowMrr - tierAgg[t].thenMrr) / tierAgg[t].thenMrr) * 100)
      : null;
  const retentionOf = (t: "Managed" | "Standard") =>
    tierAgg[t].payingThen > 0
      ? round1((tierAgg[t].retained / tierAgg[t].payingThen) * 100)
      : null;

  const managedPerformance: ManagedPerformance = {
    managedRetentionRate: retentionOf("Managed"),
    standardRetentionRate: retentionOf("Standard"),
    managedAvgMRR: avg(managedMrrs),
    standardAvgMRR: avg(standardMrrs),
    managedGrowthRate: growthOf("Managed"),
    standardGrowthRate: growthOf("Standard"),
  };

  // ── Response ──────────────────────────────────────────────────
  const data: CSDashboardData = {
    month,
    tierBreakdown,
    healthDistribution: healthCounts,
    supportMetrics,
    atRiskCustomers,
    managedPerformance,
    dataWarnings,
  };

  return NextResponse.json(data);
}
