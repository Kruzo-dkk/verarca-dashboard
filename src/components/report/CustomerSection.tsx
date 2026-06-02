"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/charts/ChartTheme";
import { CustomerTable } from "./CustomerTable";
import type { ReportData } from "@/lib/types/report";

interface CustomerSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function CustomerSection({ data, formatValue }: CustomerSectionProps) {
  const newCustomers = data.customers.newCustomers;

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Customers</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
        <GlassCard className="text-center">
          <MetricTooltip metric="customerCount">
            <span className="text-xs text-[var(--text-muted)]">Total</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1">{data.customers.count}</div>
          {data.customers.churnedLogos > 0 && (
            <a
              href="#churn"
              className="text-[11px] text-red-600 hover:underline mt-1 block"
            >
              −{data.customers.churnedLogos} this period
            </a>
          )}
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="newLogos">
            <span className="text-xs text-[var(--text-muted)]">New Logos</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1 text-emerald-600">+{data.customers.newLogos}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="arpa">
            <span className="text-xs text-[var(--text-muted)]">ARPA</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1">{formatValue(data.customers.arpa)}</div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Customer count trend */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Customer Count (24M)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.customers.countHistory} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="countGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis {...CHART_AXIS_PROPS} />
              <Tooltip
                contentStyle={{ background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.grid}`, borderRadius: "0.5rem" }}
                labelStyle={{ color: "#1A1A1A" }}
              />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.purple} fill="url(#countGradient)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Segment breakdown + concentration */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Segments & Concentration</h3>
          {data.customers.top10Concentration !== null && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-secondary)]">
              <MetricTooltip metric="top10Concentration">
                <span className="text-xs text-[var(--text-muted)]">Top 10 Revenue Concentration</span>
              </MetricTooltip>
              <div className={`metric-value text-xl ${data.customers.top10Concentration > 30 ? "text-amber-600" : "text-emerald-600"}`}>
                {data.customers.top10Concentration.toFixed(1)}%
              </div>
              {data.customers.top10Concentration > 30 && (
                <span className="text-[10px] text-amber-500">Risk: High concentration</span>
              )}
            </div>
          )}
          <div className="space-y-2">
            {data.customers.segments.map((seg) => (
              <div key={seg.segment} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{seg.segment}</span>
                <div className="flex items-center gap-3">
                  <span className="metric-value text-[var(--text-primary)]">{seg.customerCount}</span>
                  <span className="text-xs text-[var(--text-muted)]">{seg.percentOfTotal.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* New customers this period */}
      <GlassCard className="mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">New Customers</h3>
          <span className="text-xs text-[var(--text-muted)]">
            {newCustomers.length} this period
          </span>
          <a href="/customers" className="ml-auto text-xs text-[var(--accent-teal)] hover:underline">
            All customers →
          </a>
        </div>
        <div className="overflow-x-auto">
          <CustomerTable
            customers={newCustomers}
            formatValue={formatValue}
            expandable
            emptyMessage="No new customers this period"
          />
        </div>
      </GlassCard>
    </section>
  );
}
