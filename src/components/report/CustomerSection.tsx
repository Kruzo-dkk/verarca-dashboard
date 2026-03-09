"use client";

import { useState, useMemo } from "react";
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
import type { ReportData, CustomerSummary } from "@/lib/types/report";

interface CustomerSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

type TabKey = "churned" | "top" | "byPlan";

const TABS: { key: TabKey; label: string }[] = [
  { key: "churned", label: "Recently Closed" },
  { key: "top", label: "Top Customers" },
  { key: "byPlan", label: "By Plan" },
];

export function CustomerSection({ data, formatValue }: CustomerSectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("churned");

  // Group customers by plan for the "By Plan" tab
  const customersByPlan = useMemo(() => {
    const map = new Map<string, CustomerSummary[]>();
    for (const c of data.customers.topCustomers) {
      const plan = c.plan ?? "Unknown";
      const existing = map.get(plan) ?? [];
      existing.push(c);
      map.set(plan, existing);
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const totalA = a[1].reduce((s, c) => s + c.mrr, 0);
        const totalB = b[1].reduce((s, c) => s + c.mrr, 0);
        return totalB - totalA;
      });
  }, [data.customers.topCustomers]);

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

      {/* Tabbed customer views */}
      <GlassCard className="mt-4">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[var(--bg-primary)] w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-x-auto">
          {activeTab === "churned" && (
            <CustomerTable
              customers={data.customers.recentlyChurned}
              formatValue={formatValue}
              showChurnDate
              emptyMessage="No churned customers found"
            />
          )}

          {activeTab === "top" && (
            <CustomerTable
              customers={data.customers.topCustomers}
              formatValue={formatValue}
              emptyMessage="No customers found"
            />
          )}

          {activeTab === "byPlan" && (
            <div className="space-y-6">
              {customersByPlan.map(([plan, customers]) => (
                <div key={plan}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{plan}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {customers.length} customer{customers.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs metric-value text-[var(--text-secondary)]">
                      {formatValue(customers.reduce((s, c) => s + c.mrr, 0))} MRR
                    </span>
                  </div>
                  <CustomerTable
                    customers={customers}
                    formatValue={formatValue}
                    emptyMessage="No customers"
                  />
                </div>
              ))}
              {customersByPlan.length === 0 && (
                <p className="py-4 text-center text-[var(--text-muted)] text-sm">No customers found</p>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </section>
  );
}

function CustomerTable({
  customers,
  formatValue,
  showChurnDate,
  emptyMessage,
}: {
  customers: CustomerSummary[];
  formatValue: (v: number) => string;
  showChurnDate?: boolean;
  emptyMessage: string;
}) {
  if (customers.length === 0) {
    return <p className="py-4 text-center text-[var(--text-muted)] text-sm">{emptyMessage}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[var(--text-muted)]">
          <th className="pb-2 font-medium">Customer</th>
          {!showChurnDate && <th className="pb-2 font-medium text-right">MRR</th>}
          <th className="pb-2 font-medium">Plan</th>
          <th className="pb-2 font-medium">Partner</th>
          {showChurnDate ? (
            <th className="pb-2 font-medium">Closed</th>
          ) : (
            <th className="pb-2 font-medium">Status</th>
          )}
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c.id} className="border-t border-[var(--border-subtle)]">
            <td className="py-2 text-[var(--text-primary)]">{c.name}</td>
            {!showChurnDate && (
              <td className="py-2 text-right metric-value">{formatValue(c.mrr)}</td>
            )}
            <td className="py-2 text-[var(--text-secondary)]">{c.plan ?? "—"}</td>
            <td className="py-2 text-[var(--text-secondary)]">{c.partner ?? "—"}</td>
            {showChurnDate ? (
              <td className="py-2 text-[var(--text-secondary)]">{c.churnDate ?? "—"}</td>
            ) : (
              <td className="py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === "active" ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"
                }`}>
                  {c.status}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
