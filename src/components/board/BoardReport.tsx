"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DeltaPill } from "@/components/ui/DeltaPill";
import { SparkLine } from "@/components/charts/SparkLine";
import { ARRTrend } from "@/components/charts/ARRTrend";
import { PipelineFunnel } from "@/components/charts/PipelineFunnel";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReportContext } from "@/components/providers/ReportProvider";
import { useUserRole } from "@/hooks/useUserRole";
import type { BoardReportData } from "@/lib/types/board-report";
import type { MetricKey } from "@/lib/tooltip-registry";

/**
 * BoardReport — curated read-only view for board members.
 *
 * Sections: Hero KPIs → ARR Trend → Retention Gauges →
 *           Pipeline Summary → Commentary → Print/Export
 *
 * Fetches from /api/report/board (no customer names, no deal details).
 */
export function BoardReport() {
  const { month, formatValue, currency, fxRates } = useReportContext();
  const { role, displayName } = useUserRole();
  const [data, setData] = useState<BoardReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ month });
      if (currency !== "DKK") params.set("currency", currency);
      const res = await fetch(`/api/report/pdf?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verarca-board-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      // Fall back to the browser print dialog if server rendering fails.
      window.print();
    } finally {
      setExporting(false);
    }
  }, [month, currency]);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/board?month=${month}`);
      if (!res.ok) throw new Error("Failed to load board report");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-10 print:space-y-6">
      {role && role !== "management" && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Welcome{displayName ? `, ${displayName}` : ""}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Viewing data as of {month}
          </p>
        </div>
      )}

      {/* Title + print button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Board Report
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {formatMonth(data.month)} • {currency}
          </p>
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="print:hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? "Generating…" : "Export PDF"}
        </button>
      </div>

      {/* Hero KPIs */}
      <BoardHeroKPIs data={data} formatValue={formatValue} />

      {/* ARR Trend */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          ARR Trend
        </h2>
        <GlassCard>
          <ARRTrend data={data.revenue.arrHistory} formatValue={formatValue} />
        </GlassCard>
      </section>

      {/* MRR Decomposition Summary */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          MRR Movements
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <DecompositionCard
            label="New MRR"
            metric="newMRR"
            value={data.revenue.decomposition.newMRR}
            formatValue={formatValue}
            color="text-emerald-600"
          />
          <DecompositionCard
            label="Expansion"
            metric="expansionMRR"
            value={data.revenue.decomposition.expansionMRR}
            formatValue={formatValue}
            color="text-[var(--accent-coral)]"
          />
          <DecompositionCard
            label="Contraction"
            metric="contractionMRR"
            value={-data.revenue.decomposition.contractionMRR}
            formatValue={formatValue}
            color="text-amber-600"
            negative
          />
          <DecompositionCard
            label="Churned"
            metric="churnedMRR"
            value={-data.revenue.decomposition.churnedMRR}
            formatValue={formatValue}
            color="text-red-600"
            negative
          />
        </div>
      </section>

      {/* Retention */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          Retention
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <RetentionGauge
            label="Net Revenue Retention"
            metric="nrr"
            value={data.retention.nrr}
            format={(v) => `${v.toFixed(1)}%`}
            benchmark="Best-in-class: >120%"
            isGood={data.retention.nrr !== null && data.retention.nrr >= 100}
          />
          <RetentionGauge
            label="Gross Revenue Retention"
            metric="grr"
            value={data.retention.grr}
            format={(v) => `${v.toFixed(1)}%`}
            benchmark="Best-in-class: >90%"
            isGood={data.retention.grr !== null && data.retention.grr >= 90}
          />
          <RetentionGauge
            label="Logo Retention Rate"
            metric="logoRetentionRate"
            value={data.retention.logoRetentionRate}
            format={(v) => `${v.toFixed(1)}%`}
            benchmark="Target: >90%"
            isGood={data.retention.logoRetentionRate !== null && data.retention.logoRetentionRate >= 90}
          />
          <RetentionGauge
            label="Logo Churn Rate"
            metric="logoChurnRate"
            value={data.retention.logoChurnRate}
            format={(v) => `${v.toFixed(1)}%`}
            benchmark="Lower is better"
            isGood={data.retention.logoChurnRate !== null && data.retention.logoChurnRate <= 10}
          />
          <RetentionGauge
            label="Revenue Churn Rate"
            metric="revenueChurnRate"
            value={data.retention.revenueChurnRate}
            format={(v) => `${v.toFixed(1)}%`}
            benchmark="Best-in-class: <5%"
            isGood={data.retention.revenueChurnRate !== null && data.retention.revenueChurnRate <= 5}
          />
          <RetentionGauge
            label="Quick Ratio"
            metric="quickRatio"
            value={data.retention.quickRatio}
            format={(v) => (v === Infinity ? "∞" : v.toFixed(2))}
            benchmark=">4 excellent, >2 good"
            isGood={data.retention.quickRatio !== null && data.retention.quickRatio >= 2}
          />
        </div>
      </section>

      {/* Pipeline Summary */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mb-4">
          <GlassCard className="text-center">
            <MetricTooltip metric="pipelineValue">
              <span className="text-xs text-[var(--text-muted)]">Pipeline Value</span>
            </MetricTooltip>
            <div className="metric-value text-xl mt-1">
              {formatValue(data.pipeline.totalPipelineValue)}
            </div>
          </GlassCard>
          <GlassCard className="text-center">
            <MetricTooltip metric="weightedPipeline">
              <span className="text-xs text-[var(--text-muted)]">Weighted</span>
            </MetricTooltip>
            <div className="metric-value text-xl mt-1">
              {formatValue(data.pipeline.weightedPipeline)}
            </div>
          </GlassCard>
          <GlassCard className="text-center">
            <MetricTooltip metric="winRate">
              <span className="text-xs text-[var(--text-muted)]">Win Rate</span>
            </MetricTooltip>
            <div className="metric-value text-xl mt-1">
              {data.pipeline.winRate !== null ? `${data.pipeline.winRate.toFixed(0)}%` : "—"}
            </div>
          </GlassCard>
          <GlassCard className="text-center">
            <MetricTooltip metric="pipelineCoverage">
              <span className="text-xs text-[var(--text-muted)]">Coverage</span>
            </MetricTooltip>
            <div
              className={`metric-value text-xl mt-1 ${
                data.pipeline.pipelineCoverage !== null && data.pipeline.pipelineCoverage >= 3
                  ? "text-emerald-600"
                  : data.pipeline.pipelineCoverage !== null
                    ? "text-amber-600"
                    : ""
              }`}
            >
              {data.pipeline.pipelineCoverage !== null
                ? `${data.pipeline.pipelineCoverage.toFixed(1)}x`
                : "—"}
            </div>
          </GlassCard>
        </div>

        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">
            Deal Funnel
          </h3>
          <PipelineFunnel
            dealsOpen={data.pipeline.dealsOpen}
            dealsWon={data.pipeline.dealsWon}
            dealsLost={data.pipeline.dealsLost}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <MetricTooltip metric="avgDealSize">
                <span className="text-[var(--text-muted)] text-xs">Avg Deal Size</span>
              </MetricTooltip>
              <div className="metric-value">
                {data.pipeline.avgDealSize > 0 ? formatValue(data.pipeline.avgDealSize) : "—"}
              </div>
            </div>
            <div>
              <MetricTooltip metric="avgSalesCycle">
                <span className="text-[var(--text-muted)] text-xs">Avg Sales Cycle</span>
              </MetricTooltip>
              <div className="metric-value">
                {data.pipeline.avgSalesCycleDays > 0
                  ? `${data.pipeline.avgSalesCycleDays} days`
                  : "—"}
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Commentary (read-only for board) */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          Commentary
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CommentaryBlock label="Executive Summary" value={data.commentary.executiveSummary} />
          <CommentaryBlock label="Highlights" value={data.commentary.highlights} />
          <CommentaryBlock label="Lowlights" value={data.commentary.lowlights} />
          <CommentaryBlock label="What's Ahead" value={data.commentary.whatsAhead} />
        </div>
      </section>

      {/* Print footer */}
      <footer className="mt-8 pt-4 border-t border-[var(--border-subtle)] text-center print:mt-4">
        <p className="text-xs text-[var(--text-muted)]">
          Verarca • {formatMonth(data.month)} Board Report • {currency}
        </p>
      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BoardHeroKPIs({
  data,
  formatValue,
}: {
  data: BoardReportData;
  formatValue: (v: number) => string;
}) {
  const kpis: {
    label: string;
    metric: MetricKey;
    value: string;
    sparkData: { value: number }[];
    current: number;
    previous: number | null;
  }[] = [
    {
      label: "ARR",
      metric: "arr",
      value: formatValue(data.revenue.arr),
      sparkData: data.revenue.arrHistory.map((h) => ({ value: h.arr })),
      current: data.revenue.arr,
      previous:
        data.revenue.arrHistory.length >= 2
          ? data.revenue.arrHistory[data.revenue.arrHistory.length - 2]?.arr ?? null
          : null,
    },
    {
      label: "MRR",
      metric: "mrr",
      value: formatValue(data.revenue.mrr),
      sparkData: data.revenue.mrrHistory.map((h) => ({ value: h.mrr })),
      current: data.revenue.mrr,
      previous:
        data.revenue.mrrHistory.length >= 2
          ? data.revenue.mrrHistory[data.revenue.mrrHistory.length - 2]?.mrr ?? null
          : null,
    },
    {
      label: "Net New MRR",
      metric: "netNewMRR",
      value: formatValue(data.revenue.netNewMRR),
      sparkData: [],
      current: data.revenue.netNewMRR,
      previous: null,
    },
    {
      label: "NRR",
      metric: "nrr",
      value: data.retention.nrr !== null ? `${data.retention.nrr.toFixed(1)}%` : "—",
      sparkData: data.retention.nrrHistory.map((h) => ({ value: h.nrr })),
      current: data.retention.nrr ?? 0,
      previous:
        data.retention.nrrHistory.length >= 2
          ? data.retention.nrrHistory[data.retention.nrrHistory.length - 2]?.nrr ?? null
          : null,
    },
    {
      label: "Active Customers",
      metric: "activeCustomers",
      value: data.customers.count.toLocaleString(),
      sparkData: [],
      current: data.customers.count,
      previous: null,
    },
    {
      label: "Quick Ratio",
      metric: "quickRatio",
      value:
        data.retention.quickRatio !== null
          ? data.retention.quickRatio === Infinity
            ? "∞"
            : data.retention.quickRatio.toFixed(1)
          : "—",
      sparkData: [],
      current: data.retention.quickRatio ?? 0,
      previous: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <GlassCard key={kpi.label} className="flex flex-col gap-1.5 sm:gap-2">
          <MetricTooltip metric={kpi.metric}>
            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide sm:tracking-wider">
              {kpi.label}
            </span>
          </MetricTooltip>
          <span className="metric-value text-xl sm:text-2xl text-[var(--text-primary)]">
            {kpi.value}
          </span>
          <div className="flex items-center gap-2">
            {kpi.previous !== null && (
              <DeltaPill
                current={kpi.current}
                previous={kpi.previous}
                format={kpi.metric === "nrr" ? "points" : "percent"}
              />
            )}
          </div>
          {kpi.sparkData.length > 1 && (
            <div className="mt-1">
              <SparkLine data={kpi.sparkData} />
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

function DecompositionCard({
  label,
  metric,
  value,
  formatValue,
  color,
  negative,
}: {
  label: string;
  metric: MetricKey;
  value: number;
  formatValue: (v: number) => string;
  color: string;
  negative?: boolean;
}) {
  return (
    <GlassCard className="text-center">
      <MetricTooltip metric={metric}>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </MetricTooltip>
      <div className={`metric-value text-xl mt-1 ${color}`}>
        {negative && value !== 0 ? "−" : ""}
        {formatValue(Math.abs(value))}
      </div>
    </GlassCard>
  );
}

function RetentionGauge({
  label,
  metric,
  value,
  format,
  benchmark,
  isGood,
}: {
  label: string;
  metric: MetricKey;
  value: number | null;
  format: (v: number) => string;
  benchmark: string;
  isGood: boolean;
}) {
  return (
    <GlassCard className="text-center">
      <MetricTooltip metric={metric}>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </MetricTooltip>
      <div
        className={`metric-value text-2xl mt-2 ${
          isGood
            ? "text-emerald-600"
            : value !== null
              ? "text-amber-600"
              : "text-[var(--text-muted)]"
        }`}
      >
        {value !== null ? format(value) : "—"}
      </div>
      <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
        {benchmark}
      </span>
    </GlassCard>
  );
}

function CommentaryBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <GlassCard>
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">{label}</h3>
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
        {value || "No commentary provided."}
      </p>
    </GlassCard>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonth(ym: string): string {
  const [yr, mo] = ym.split("-");
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
}
