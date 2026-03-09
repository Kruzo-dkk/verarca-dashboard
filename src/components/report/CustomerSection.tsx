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
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS } from "@/components/charts/ChartTheme";
import type { ReportData } from "@/lib/types/report";

interface CustomerSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function CustomerSection({ data, formatValue }: CustomerSectionProps) {
  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Customers</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Total</span>
          <div className="metric-value text-2xl mt-1">{data.customers.count}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">New Logos</span>
          <div className="metric-value text-2xl mt-1 text-emerald-400">+{data.customers.newLogos}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">Churned</span>
          <div className="metric-value text-2xl mt-1 text-red-400">-{data.customers.churnedLogos}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <span className="text-xs text-[var(--text-muted)]">ARPA</span>
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
                labelStyle={{ color: "#F8FAFC" }}
              />
              <Area type="monotone" dataKey="count" stroke={CHART_COLORS.purple} fill="url(#countGradient)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Segment breakdown + concentration */}
        <GlassCard>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Segments & Concentration</h3>
          {data.customers.top10Concentration !== null && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--bg-primary)]">
              <span className="text-xs text-[var(--text-muted)]">Top 10 Revenue Concentration</span>
              <div className={`metric-value text-xl ${data.customers.top10Concentration > 30 ? "text-amber-400" : "text-emerald-400"}`}>
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

      {/* Top customers */}
      {data.customers.topCustomers.length > 0 && (
        <GlassCard className="mt-4">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">Top Customers by MRR</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)]">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium text-right">MRR</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Partner</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.topCustomers.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--border-subtle)]">
                    <td className="py-2 text-[var(--text-primary)]">{c.name}</td>
                    <td className="py-2 text-right metric-value">{formatValue(c.mrr)}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{c.plan ?? "—"}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{c.partner ?? "—"}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.status === "active" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </section>
  );
}
