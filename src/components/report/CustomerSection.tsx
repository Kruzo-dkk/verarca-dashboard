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
import { MetricTooltip } from "@/components/ui/MetricTooltip";
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
          <MetricTooltip metric="customerCount">
            <span className="text-xs text-[var(--text-muted)]">Total</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1">{data.customers.count}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="newLogos">
            <span className="text-xs text-[var(--text-muted)]">New Logos</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1 text-emerald-600">+{data.customers.newLogos}</div>
        </GlassCard>
        <GlassCard className="text-center">
          <MetricTooltip metric="churnedLogos">
            <span className="text-xs text-[var(--text-muted)]">Churned</span>
          </MetricTooltip>
          <div className="metric-value text-2xl mt-1 text-red-600">-{data.customers.churnedLogos}</div>
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

      {/* Tabbed customer views */}
      <GlassCard className="mt-4">
        {/* Tab bar */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit">
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

function formatChurnDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    <table className="w-full text-sm table-fixed">
      <colgroup>
        <col style={{ width: "35%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "25%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "10%" }} />
      </colgroup>
      <thead>
        <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
          <th className="pb-2 font-medium">Customer</th>
          <th className="pb-2 font-medium text-right pr-4">MRR</th>
          <th className="pb-2 font-medium hidden sm:table-cell pl-4">Plan</th>
          <th className="pb-2 font-medium hidden md:table-cell">Partner</th>
          {showChurnDate ? (
            <th className="pb-2 font-medium">Closed</th>
          ) : (
            <th className="pb-2 font-medium hidden sm:table-cell">Status</th>
          )}
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c.id} className="border-t border-[var(--border-subtle)]">
            <td className="py-1.5 text-[var(--text-primary)] font-medium truncate">
              <div className="truncate">
                {c.name}
                {c.plan && (
                  <span className="text-[11px] text-[var(--text-muted)] font-normal sm:hidden block truncate">
                    {c.plan}
                  </span>
                )}
              </div>
            </td>
            <td className="py-1.5 text-right metric-value pr-4 tabular-nums">{formatValue(c.mrr)}</td>
            <td className="py-1.5 text-[var(--text-secondary)] hidden sm:table-cell pl-4 truncate" title={c.plan ?? undefined}>{c.plan ?? "—"}</td>
            <td className="py-1.5 text-[var(--text-secondary)] hidden md:table-cell truncate">{c.partner ?? "—"}</td>
            {showChurnDate ? (
              <td className="py-1.5 text-[var(--text-secondary)] text-xs">
                {formatChurnDate(c.churnDate)}
              </td>
            ) : (
              <td className="py-1.5 hidden sm:table-cell">
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  c.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
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
