"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { ChurnChart } from "@/components/ChurnChart";
import { CustomerTable } from "./CustomerTable";
import type { ReportData } from "@/lib/types/report";
import type { MonthlyChurn } from "@/lib/metrics";

interface ChurnSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function ChurnSection({ data, formatValue }: ChurnSectionProps) {
  const [trend, setTrend] = useState<MonthlyChurn[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/churn?months=12")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load churn trend"))))
      .then((payload: { monthlyChurn: MonthlyChurn[] }) => {
        if (!cancelled) setTrend(payload.monthlyChurn);
      })
      .catch(() => {
        if (!cancelled) setTrend([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { logoChurnRate, revenueChurnRate } = data.retention;
  const { churnedLogos, churnedMRR, recentlyChurned } = data.customers;

  return (
    <section id="churn">
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Churn</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
        <GlassCard className="text-center">
          <MetricTooltip metric="logoChurnRate">
            <span className="text-xs text-[var(--text-muted)]">Logo Churn</span>
          </MetricTooltip>
          <div className="metric-value text-3xl mt-2 text-red-600">
            {logoChurnRate !== null ? `${logoChurnRate.toFixed(1)}%` : "—"}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
            {churnedLogos} customer{churnedLogos !== 1 ? "s" : ""} lost
          </span>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="revenueChurnRate">
            <span className="text-xs text-[var(--text-muted)]">Revenue Churn</span>
          </MetricTooltip>
          <div className="metric-value text-3xl mt-2 text-red-600">
            {revenueChurnRate !== null ? `${revenueChurnRate.toFixed(1)}%` : "—"}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
            −{formatValue(churnedMRR)} MRR
          </span>
        </GlassCard>
      </div>

      {/* Trend chart */}
      {trend && trend.length > 0 && <ChurnChart data={trend} />}

      {/* Recently closed table */}
      <GlassCard className="mt-4">
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Recently Closed</h3>
        <div className="overflow-x-auto">
          <CustomerTable
            customers={recentlyChurned}
            formatValue={formatValue}
            showChurnDate
            emptyMessage="No churned customers in this period"
          />
        </div>
      </GlassCard>
    </section>
  );
}
