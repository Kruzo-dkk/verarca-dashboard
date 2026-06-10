import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPipelineStages } from "@/lib/hubspot";
import type {
  SalesDashboardData,
  SalesTargets,
  PipelineDetail,
  StageGroup,
  SalesDeal,
  ActivitySummary,
  ActivityCounts,
  OwnerActivity,
  LeaderboardEntry,
  DealOutcome,
} from "@/lib/types/sales";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    searchParams.get("month") ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const admin = createAdminClient();

  // Last calendar day of the month — `activity_snapshots.date` is a real `date`
  // column, so a hardcoded `-31` is an invalid date in 30-day months (and Feb)
  // and makes Postgres reject the query outright.
  const [yy, mm] = month.split("-").map(Number);
  const monthEnd = `${month}-${String(new Date(yy, mm, 0).getDate()).padStart(2, "0")}`;

  // ── Fetch all data in parallel ────────────────────────────────
  const [pipelineRes, targetsRes, activityRes, monthlyRes, stagesResult] =
    await Promise.all([
      admin
        .from("pipeline_snapshots")
        .select("*")
        .eq("month", month)
        .order("created_at", { ascending: false })
        .limit(1),
      admin.from("sales_targets").select("*").eq("month", month).maybeSingle(),
      admin
        .from("activity_snapshots")
        .select("*")
        .gte("date", `${month}-01`)
        .lte("date", monthEnd),
      admin
        .from("monthly_snapshots")
        .select("new_mrr, new_logos")
        .eq("month", month)
        .maybeSingle(),
      getPipelineStages().catch(() => [] as Awaited<ReturnType<typeof getPipelineStages>>),
    ]);

  const pipeline = pipelineRes.data?.[0];
  const targetsRow = targetsRes.data;
  const activities = activityRes.data ?? [];
  const monthlySnap = monthlyRes.data;

  // Resolve HubSpot owner IDs → names from activity rows (the only source of
  // owner names we have), so deals/outcomes can show who owns them.
  const ownerNameById = new Map<string, string>();
  for (const a of activities) {
    if (a.owner_id && a.owner_name) ownerNameById.set(a.owner_id, a.owner_name);
  }
  const ownerName = (id: string | undefined): string | null =>
    id ? ownerNameById.get(id) ?? null : null;

  // ── Pipeline detail ────────────────────────────────────────────
  // Win/loss/open, stage labels and probability come from the STORED deal
  // fields (stamped at sync time). The live stage map is only a fallback for
  // rows written before those fields existed — so the board never depends on a
  // live HubSpot call succeeding at request time.
  const stageMap = new Map(stagesResult.map((s) => [s.stageId, s]));
  const rawDeals: Array<{
    id: string;
    dealname: string;
    amount: number;
    dealstage: string;
    stageLabel: string;
    closedate: string | null;
    days_to_close: string | null;
    probability: number; // 0–1 decimal
    isClosed: boolean;
    isWon: boolean;
    displayOrder: number;
    hubspot_owner_id?: string;
  }> = [];

  if (pipeline?.deals_json) {
    const dealsArr = Array.isArray(pipeline.deals_json)
      ? pipeline.deals_json
      : [];
    for (const d of dealsArr) {
      // Flat StoredDeal shape written by buildStoredDeals (sync-pipeline).
      const deal = d as {
        id?: string;
        name?: string;
        amount?: string | number | null;
        stage?: string;
        stage_label?: string | null;
        closedate?: string | null;
        days_to_close?: string | null;
        owner_id?: string | null;
        probability?: number | string | null;
        is_closed?: boolean;
        is_won?: boolean;
      };
      const stage = stageMap.get(deal.stage ?? "");
      const probability =
        deal.probability != null
          ? Number(deal.probability)
          : stage?.probability ?? 0;
      const isClosed = deal.is_closed ?? stage?.isClosed ?? false;
      const isWon = deal.is_won ?? (isClosed && probability >= 1);
      const closedate = deal.closedate ? deal.closedate.slice(0, 10) : null;
      rawDeals.push({
        id: deal.id ?? "",
        dealname: deal.name ?? "Unnamed",
        amount: Math.round(parseFloat(String(deal.amount ?? "0")) * 100),
        dealstage: deal.stage ?? "",
        stageLabel: deal.stage_label || stage?.label || deal.stage || "",
        closedate: closedate || null,
        days_to_close: deal.days_to_close ?? null,
        probability,
        isClosed,
        isWon,
        displayOrder: stage?.displayOrder ?? 999,
        hubspot_owner_id: deal.owner_id ?? undefined,
      });
    }
  }

  // Group by stage — only OPEN deals belong on the pipeline board.
  const stageGroups = new Map<string, SalesDeal[]>();
  for (const d of rawDeals) {
    if (d.isClosed) continue;
    const list = stageGroups.get(d.dealstage) ?? [];
    list.push({
      id: d.id,
      name: d.dealname,
      amount: d.amount,
      stage: d.dealstage,
      stageLabel: d.stageLabel,
      probability: d.probability,
      closeDate: d.closedate,
      daysToClose: d.days_to_close ? parseInt(d.days_to_close) : null,
      ownerName: ownerName(d.hubspot_owner_id),
    });
    stageGroups.set(d.dealstage, list);
  }

  const stageMetaById = new Map(rawDeals.map((d) => [d.dealstage, d]));
  const stages: StageGroup[] = Array.from(stageGroups.entries())
    .map(([stageId, deals]) => {
      const meta = stageMetaById.get(stageId);
      const totalValue = deals.reduce((s, d) => s + d.amount, 0);
      return {
        stageId,
        label: meta?.stageLabel || stageId,
        displayOrder: meta?.displayOrder ?? 999,
        deals,
        totalValue,
        weightedValue: Math.round(totalValue * (meta?.probability ?? 0)),
      };
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const pipelineDetail: PipelineDetail = {
    stages,
    totalValue: pipeline?.total_pipeline_value ?? 0,
    weightedValue: pipeline?.weighted_pipeline ?? 0,
    dealCount: pipeline?.deals_open ?? 0,
  };

  // ── Activities ────────────────────────────────────────────────
  const today = now.toISOString().split("T")[0];
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const sumActivities = (
    rows: typeof activities,
    filter: (r: (typeof activities)[0]) => boolean
  ): ActivityCounts => {
    const filtered = rows.filter(filter);
    return {
      calls: filtered.reduce((s, r) => s + (r.calls_made ?? 0), 0),
      meetings: filtered.reduce((s, r) => s + (r.meetings_booked ?? 0), 0),
      emails: filtered.reduce((s, r) => s + (r.emails_sent ?? 0), 0),
    };
  };

  const todayCounts = sumActivities(activities, (r) => r.date === today);
  const weekCounts = sumActivities(activities, (r) => r.date >= weekStartStr);
  const monthCounts = sumActivities(activities, () => true);

  // Per-owner
  const ownerMap = new Map<string, { name: string; rows: typeof activities }>();
  for (const a of activities) {
    const existing = ownerMap.get(a.owner_id) ?? {
      name: a.owner_name ?? a.owner_id,
      rows: [],
    };
    existing.rows.push(a);
    ownerMap.set(a.owner_id, existing);
  }

  const byOwner: OwnerActivity[] = Array.from(ownerMap.entries()).map(
    ([ownerId, { name, rows }]) => ({
      ownerId,
      ownerName: name,
      today: sumActivities(rows, (r) => r.date === today),
      thisWeek: sumActivities(rows, (r) => r.date >= weekStartStr),
      thisMonth: sumActivities(rows, () => true),
    })
  );

  const activitySummary: ActivitySummary = {
    today: todayCounts,
    thisWeek: weekCounts,
    thisMonth: monthCounts,
    byOwner,
  };

  // ── Targets ────────────────────────────────────────────────────
  const actualNewMRR = monthlySnap?.new_mrr ?? 0;
  const actualNewLogos = monthlySnap?.new_logos ?? 0;
  const actualPipeline = pipeline?.total_pipeline_value ?? 0;

  const targets: SalesTargets = {
    targetNewMRR: targetsRow?.target_new_mrr ?? 0,
    targetNewLogos: targetsRow?.target_new_logos ?? 0,
    targetPipeline: targetsRow?.target_pipeline ?? 0,
    targetMeetings: targetsRow?.target_meetings ?? 0,
    targetCalls: targetsRow?.target_calls ?? 0,
    actualNewMRR: actualNewMRR,
    actualNewLogos: actualNewLogos,
    actualPipeline: actualPipeline,
    actualMeetings: monthCounts.meetings,
    actualCalls: monthCounts.calls,
  };

  // ── Leaderboard ────────────────────────────────────────────────
  // Combine deal wins with activity data
  const wonDeals = rawDeals.filter((d) => d.isWon);

  const leaderboard: LeaderboardEntry[] = byOwner
    .map((o) => {
      const ownerWins = wonDeals.filter(
        (d) => d.hubspot_owner_id === o.ownerId
      );
      return {
        ownerId: o.ownerId,
        ownerName: o.ownerName,
        dealsWon: ownerWins.length,
        mrrClosed: ownerWins.reduce((s, d) => s + d.amount, 0),
        totalActivities:
          o.thisMonth.calls + o.thisMonth.meetings + o.thisMonth.emails,
      };
    })
    .sort((a, b) => b.mrrClosed - a.mrrClosed);

  // ── Recent outcomes ────────────────────────────────────────────
  const closedDeals = rawDeals.filter((d) => d.isClosed && d.closedate);

  const toDealOutcome = (d: (typeof rawDeals)[0]): DealOutcome => ({
    id: d.id,
    name: d.dealname,
    amount: d.amount,
    closeDate: d.closedate ?? "",
    ownerName: ownerName(d.hubspot_owner_id),
  });

  const recentWins: DealOutcome[] = closedDeals
    .filter((d) => d.isWon)
    .sort((a, b) => (b.closedate ?? "").localeCompare(a.closedate ?? ""))
    .slice(0, 5)
    .map(toDealOutcome);

  const recentLosses: DealOutcome[] = closedDeals
    .filter((d) => !d.isWon)
    .sort((a, b) => (b.closedate ?? "").localeCompare(a.closedate ?? ""))
    .slice(0, 5)
    .map(toDealOutcome);

  // ── Response ────────────────────────────────────────────────────
  const data: SalesDashboardData = {
    month,
    targets,
    pipeline: pipelineDetail,
    activities: activitySummary,
    leaderboard,
    recentWins,
    recentLosses,
  };

  return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to build sales dashboard:", error);
    return NextResponse.json(
      { error: "Failed to load sales data" },
      { status: 500 }
    );
  }
}
