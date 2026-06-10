"use client";

import { useState, useEffect, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { ARRTrend } from "@/components/charts/ARRTrend";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useReportContext } from "@/components/providers/ReportProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { BenchmarkSection } from "./BenchmarkSection";
import type { InvestorReportData } from "@/lib/types/investor-report";
import type { BenchmarkMetricKey } from "@/lib/benchmarks";
import type { MetricKey } from "@/lib/tooltip-registry";

/**
 * InvestorDashboard — M&A-centric view.
 *
 * Sections:
 * 1. Revenue Quality (ARR, retention, concentration, growth)
 * 2. Growth Efficiency (LTV/CAC, payback, Rule of 40)
 * 3. ARR Trend chart
 */
export function InvestorDashboard() {
  const { month, formatValue, currency } = useReportContext();
  const { role, displayName } = useUserRole();
  const [data, setData] = useState<InvestorReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/investor?month=${month}`);
      if (!res.ok) throw new Error("Failed to load investor report");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchInvestor();
  }, [fetchInvestor]);

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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const rq = data.revenueQuality;
  const ge = data.growthEfficiency;

  // ARR growth label: true YoY once a full year of history exists, otherwise
  // inception-to-date growth so the high-growth signal isn't shown as blank.
  const arrInception = inceptionGrowthPct(rq.arrHistory);
  const arrGrowth: { pct: number; label: string } | null =
    rq.growthYoY !== null
      ? { pct: rq.growthYoY, label: "YoY" }
      : arrInception !== null
        ? { pct: arrInception, label: "siden start" }
        : null;

  return (
    <div className="space-y-10">
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

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Investor Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {formatMonth(data.month)} • {currency}
        </p>
      </div>

      {/* ── Revenue Quality ──────────────────────────────────────── */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          Revenue Quality
        </h2>

        {/* Primary revenue metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mb-4">
          <MetricCard
            label="ARR"
            metric="arr"
            value={formatValue(rq.arr)}
            subtext={arrGrowth ? `${arrGrowth.pct >= 0 ? "+" : ""}${arrGrowth.pct.toFixed(arrGrowth.label === "YoY" ? 1 : 0)}% ${arrGrowth.label}` : undefined}
            subtextColor={arrGrowth && arrGrowth.pct >= 0 ? "text-emerald-600" : "text-red-600"}
          />
          <MetricCard
            label="MRR"
            metric="mrr"
            value={formatValue(rq.mrr)}
            subtext={rq.growthMoM !== null ? `${rq.growthMoM >= 0 ? "+" : ""}${rq.growthMoM.toFixed(1)}% MoM` : undefined}
            subtextColor={rq.growthMoM !== null && rq.growthMoM >= 0 ? "text-emerald-600" : "text-red-600"}
          />
          <MetricCard
            label="Active Customers"
            metric="activeCustomers"
            value={rq.customerCount.toLocaleString()}
          />
          <MetricCard
            label="ARPA"
            metric="arpa"
            value={formatValue(rq.arpa)}
          />
        </div>

        {/* Retention metrics */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mb-4">
          <RetentionCard
            label="Net Revenue Retention"
            metric="nrr"
            value={rq.nrr}
            format={(v) => `${v.toFixed(1)}%`}
            threshold={100}
          />
          <RetentionCard
            label="Gross Revenue Retention"
            metric="grr"
            value={rq.grr}
            format={(v) => `${v.toFixed(1)}%`}
            threshold={90}
          />
          <RetentionCard
            label="Logo Retention"
            metric="logoRetentionRate"
            value={rq.logoRetentionRate}
            format={(v) => `${v.toFixed(1)}%`}
            threshold={90}
          />
          <RetentionCard
            label="Quick Ratio"
            metric="quickRatio"
            value={rq.quickRatio}
            format={(v) => (v === Infinity ? "∞" : v.toFixed(2))}
            threshold={2}
          />
        </div>

        {/* Concentration */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GlassCard>
            <MetricTooltip metric="top10Concentration">
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
                Top 10 Revenue Concentration
              </h3>
            </MetricTooltip>
            <div className="flex items-baseline gap-3">
              <span
                className={`metric-value text-3xl ${
                  rq.top10Concentration !== null && rq.top10Concentration <= 30
                    ? "text-emerald-600"
                    : rq.top10Concentration !== null && rq.top10Concentration >= 50
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {rq.top10Concentration !== null
                  ? `${rq.top10Concentration.toFixed(1)}%`
                  : "—"}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {"<30% healthy, >50% risky"}
              </span>
            </div>
            {rq.top10Concentration !== null && (
              <div className="mt-3 h-3 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    rq.top10Concentration <= 30
                      ? "bg-emerald-500"
                      : rq.top10Concentration >= 50
                        ? "bg-red-500"
                        : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(rq.top10Concentration, 100)}%` }}
                />
              </div>
            )}
          </GlassCard>

          {/* ARR Trend (compact) */}
          <GlassCard>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">
              ARR Trend
            </h3>
            <ARRTrend data={rq.arrHistory} formatValue={formatValue} />
          </GlassCard>
        </div>
      </section>

      {/* ── Growth Efficiency ────────────────────────────────────── */}
      <section>
        <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">
          Growth Efficiency
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          <EfficiencyCard
            label="LTV/CAC Ratio"
            metric="ltvCacRatio"
            value={ge.ltvCacRatio}
            format={(v) => `${v.toFixed(1)}x`}
            benchmark=">3x healthy, >5x excellent"
            threshold={3}
          />
          <EfficiencyCard
            label="CAC Payback"
            value={ge.cacPaybackMonths}
            format={(v) => `${v.toFixed(0)} mo`}
            benchmark="<18 mo healthy"
            threshold={18}
            invertThreshold
            subtext="Assumes 100% gross margin"
          />
          <EfficiencyCard
            label="LTV"
            metric="ltv"
            value={ge.ltv}
            format={(v) => formatValue(v)}
          />
          <EfficiencyCard
            label="CAC"
            metric="cac"
            value={ge.cac}
            format={(v) => formatValue(v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 mt-4">
          <EfficiencyCard
            label="Revenue / Employee"
            metric="revenuePerEmployee"
            value={ge.revenuePerEmployee}
            format={(v) => formatValue(v)}
            subtext={ge.employeeCount !== null ? `${ge.employeeCount} employees` : undefined}
          />
          <EfficiencyCard
            label="Rule of 40"
            metric="ruleOf40"
            value={ge.ruleOf40}
            format={(v) => `${v.toFixed(0)}%`}
            benchmark=">40% excellent"
            threshold={40}
            notConfiguredText="Requires gross margin"
          />
          <EfficiencyCard
            label="Burn Multiple"
            value={ge.burnMultiple}
            format={(v) => `${v.toFixed(1)}x`}
            benchmark="<1.5x efficient"
            threshold={1.5}
            invertThreshold
            notConfiguredText="Requires burn data"
          />
          <EfficiencyCard
            label="Magic Number"
            value={ge.magicNumber}
            format={(v) => v.toFixed(2)}
            benchmark=">0.75 efficient"
            threshold={0.75}
            notConfiguredText="Requires S&M spend"
          />
        </div>
      </section>

      {/* ── Benchmark Comparison ──────────────────────────────────── */}
      <BenchmarkSection
        arrDKKOre={rq.arr}
        companyMetrics={buildBenchmarkMetrics(rq, ge)}
        formatValue={formatValue}
      />

      {/* Footer */}
      <footer className="mt-8 pt-4 border-t border-[var(--border-subtle)] text-center">
        <p className="text-xs text-[var(--text-muted)]">
          Verarca • {formatMonth(data.month)} Investor Dashboard • {currency}
        </p>
      </footer>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  metric,
  value,
  subtext,
  subtextColor,
}: {
  label: string;
  metric?: MetricKey;
  value: string;
  subtext?: string;
  subtextColor?: string;
}) {
  const inner = (
    <>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <div className="metric-value text-xl sm:text-2xl mt-1 text-[var(--text-primary)]">
        {value}
      </div>
      {subtext && (
        <span className={`text-xs mt-1 block ${subtextColor ?? "text-[var(--text-muted)]"}`}>
          {subtext}
        </span>
      )}
    </>
  );

  return (
    <GlassCard className="text-center">
      {metric ? (
        <MetricTooltip metric={metric}>{inner}</MetricTooltip>
      ) : (
        inner
      )}
    </GlassCard>
  );
}

function RetentionCard({
  label,
  metric,
  value,
  format,
  threshold,
}: {
  label: string;
  metric: MetricKey;
  value: number | null;
  format: (v: number) => string;
  threshold: number;
}) {
  const isGood = value !== null && value >= threshold;

  return (
    <GlassCard className="text-center">
      <MetricTooltip metric={metric}>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </MetricTooltip>
      <div
        className={`metric-value text-xl sm:text-2xl mt-1 ${
          isGood
            ? "text-emerald-600"
            : value !== null
              ? "text-amber-600"
              : "text-[var(--text-muted)]"
        }`}
      >
        {value !== null ? format(value) : "—"}
      </div>
    </GlassCard>
  );
}

function EfficiencyCard({
  label,
  metric,
  value,
  format,
  benchmark,
  subtext,
  threshold,
  invertThreshold,
  notConfiguredText,
}: {
  label: string;
  metric?: MetricKey;
  value: number | null;
  format: (v: number) => string;
  benchmark?: string;
  subtext?: string;
  threshold?: number;
  invertThreshold?: boolean;
  notConfiguredText?: string;
}) {
  let colorClass = "text-[var(--text-primary)]";
  if (value !== null && threshold !== undefined) {
    const isGood = invertThreshold ? value <= threshold : value >= threshold;
    colorClass = isGood ? "text-emerald-600" : "text-amber-600";
  }

  const inner = (
    <>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <div className={`metric-value text-xl mt-1 ${value === null ? "text-[var(--text-muted)]" : colorClass}`}>
        {value !== null ? format(value) : "—"}
      </div>
      {value === null && notConfiguredText && (
        <span className="text-[10px] text-[var(--text-muted)] mt-1 block italic">
          {notConfiguredText}
        </span>
      )}
      {benchmark && value !== null && (
        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
          {benchmark}
        </span>
      )}
      {subtext && (
        <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
          {subtext}
        </span>
      )}
    </>
  );

  return (
    <GlassCard className="text-center">
      {metric ? (
        <MetricTooltip metric={metric}>{inner}</MetricTooltip>
      ) : (
        inner
      )}
    </GlassCard>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Map investor report data to the BenchmarkMetricKey format
 * expected by BenchmarkSection.
 */
/**
 * Inception-to-date ARR growth (%) — a fallback for the YoY growth rate while
 * the company has under 12 months of history (so `growthYoY` is structurally
 * null). Uses the oldest month with positive ARR as the base.
 */
function inceptionGrowthPct(
  arrHistory: { month: string; arr: number }[]
): number | null {
  if (arrHistory.length < 2) return null;
  const sorted = [...arrHistory].sort((a, b) => a.month.localeCompare(b.month));
  const base = sorted.find((h) => h.arr > 0)?.arr ?? 0;
  const latest = sorted[sorted.length - 1]?.arr ?? 0;
  return base > 0 ? ((latest - base) / base) * 100 : null;
}

function buildBenchmarkMetrics(
  rq: InvestorReportData["revenueQuality"],
  ge: InvestorReportData["growthEfficiency"]
): Partial<Record<BenchmarkMetricKey, number | null>> {
  return {
    nrr: rq.nrr,
    grr: rq.grr,
    logoRetention: rq.logoRetentionRate,
    // YoY when a full year of history exists; otherwise inception-to-date growth
    // (the company is < 12 months old, so YoY is structurally null).
    growthRate: rq.growthYoY ?? inceptionGrowthPct(rq.arrHistory),
    ltvCac: ge.ltvCacRatio,
    cacPayback: ge.cacPaybackMonths,
    ruleOf40: ge.ruleOf40,
    burnMultiple: ge.burnMultiple,
    magicNumber: ge.magicNumber,
    // grossMargin: not yet available — requires accounting integration
  };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMonth(ym: string): string {
  const [yr, mo] = ym.split("-");
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
}
