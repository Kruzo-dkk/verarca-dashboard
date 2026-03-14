"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { ReportData, ChannelMetrics, LeadSource } from "@/lib/types/report";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_MARGIN } from "@/components/charts/ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";

// ─── Constants ──────────────────────────────────────────────────

const CHANNEL_COLORS: Record<LeadSource, string> = {
  outbound: CHART_COLORS.teal,
  partner: CHART_COLORS.coral,
  inbound: CHART_COLORS.emerald,
};

const CHANNEL_LABELS: Record<LeadSource, string> = {
  outbound: "Outbound",
  partner: "Partner",
  inbound: "Inbound",
};

// ─── Types ──────────────────────────────────────────────────────

interface ChannelSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

// ─── Component ──────────────────────────────────────────────────

export function ChannelSection({ data, formatValue }: ChannelSectionProps) {
  const isMobile = useIsMobile();
  const { byChannel, byPartner } = data.channels;

  const totalNewLogos = byChannel.reduce((s, c) => s + c.newLogos, 0);
  const totalNewMRR = byChannel.reduce((s, c) => s + c.newMRR, 0);

  // If there's no channel data at all, don't render
  if (byChannel.length === 0 && byPartner.length === 0) return null;

  // Chart data: MRR by channel
  const chartData = byChannel
    .filter((c) => c.newMRR > 0 || c.newLogos > 0)
    .map((c) => ({
      channel: CHANNEL_LABELS[c.channel],
      newMRR: c.newMRR / 100, // convert øre to kroner for display
      color: CHANNEL_COLORS[c.channel],
    }));

  return (
    <section className="space-y-4">
      <h2 className="section-heading text-[var(--text-primary)]">
        Channel Attribution
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Channel Breakdown Table */}
        <GlassCard>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            New Business by Channel
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium text-right">Logos</th>
                  <th className="pb-2 font-medium text-right">New MRR</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">
                    %
                  </th>
                  <th className="pb-2 font-medium text-right hidden lg:table-cell">
                    Win %
                  </th>
                  <th className="pb-2 font-medium text-right hidden lg:table-cell">
                    Avg Deal
                  </th>
                  <th className="pb-2 font-medium text-right hidden xl:table-cell">
                    Cycle
                  </th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">
                    CAC
                  </th>
                </tr>
              </thead>
              <tbody>
                {byChannel.map((ch) => (
                  <ChannelRow
                    key={ch.channel}
                    metrics={ch}
                    totalNewMRR={totalNewMRR}
                    formatValue={formatValue}
                  />
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-[var(--border-subtle)] font-semibold">
                  <td className="pt-2 text-[var(--text-primary)]">Total</td>
                  <td className="pt-2 text-right metric-value">
                    {totalNewLogos}
                  </td>
                  <td className="pt-2 text-right metric-value">
                    {formatValue(totalNewMRR)}
                  </td>
                  <td className="pt-2 text-right metric-value hidden sm:table-cell">
                    100%
                  </td>
                  <td className="pt-2 text-right hidden lg:table-cell">—</td>
                  <td className="pt-2 text-right hidden lg:table-cell">—</td>
                  <td className="pt-2 text-right hidden xl:table-cell">—</td>
                  <td className="pt-2 text-right hidden sm:table-cell">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* New MRR by Channel Chart */}
        <GlassCard>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            New MRR Attribution
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
              <BarChart data={chartData} margin={CHART_MARGIN}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis
                  dataKey="channel"
                  {...CHART_AXIS_PROPS}
                />
                <YAxis
                  {...CHART_AXIS_PROPS}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: CHART_COLORS.tooltipBg,
                    border: `1px solid ${CHART_COLORS.grid}`,
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  formatter={(value: number | undefined) => [
                    `kr ${(value ?? 0).toLocaleString()}`,
                    "New MRR",
                  ]}
                />
                <Bar dataKey="newMRR" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-[var(--text-muted)]">
              No new business this month
            </div>
          )}
        </GlassCard>
      </div>

      {/* Partner Performance */}
      {byPartner.length > 0 && (
        <PartnerPerformance partners={byPartner} formatValue={formatValue} />
      )}
    </section>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function ChannelRow({
  metrics,
  totalNewMRR,
  formatValue,
}: {
  metrics: ChannelMetrics;
  totalNewMRR: number;
  formatValue: (v: number) => string;
}) {
  const pctOfTotal =
    totalNewMRR > 0
      ? Math.round((metrics.newMRR / totalNewMRR) * 1000) / 10
      : 0;

  return (
    <tr className="border-b border-[var(--border-subtle)] last:border-b-0">
      <td className="py-1.5 flex items-center gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: CHANNEL_COLORS[metrics.channel] }}
        />
        <span className="text-[var(--text-primary)] font-medium">
          {CHANNEL_LABELS[metrics.channel]}
        </span>
      </td>
      <td className="py-1.5 text-right metric-value">{metrics.newLogos}</td>
      <td className="py-1.5 text-right metric-value">
        {formatValue(metrics.newMRR)}
      </td>
      <td className="py-1.5 text-right text-[var(--text-secondary)] hidden sm:table-cell">
        {pctOfTotal > 0 ? `${pctOfTotal}%` : "—"}
      </td>
      <td className="py-1.5 text-right text-[var(--text-secondary)] hidden lg:table-cell">
        {metrics.winRate != null ? `${Math.round(metrics.winRate)}%` : "—"}
      </td>
      <td className="py-1.5 text-right text-[var(--text-secondary)] hidden lg:table-cell">
        {metrics.avgDealSize != null ? formatValue(metrics.avgDealSize) : "—"}
      </td>
      <td className="py-1.5 text-right text-[var(--text-secondary)] hidden xl:table-cell">
        {metrics.avgSalesCycleDays != null
          ? `${metrics.avgSalesCycleDays}d`
          : "—"}
      </td>
      <td className="py-1.5 text-right text-[var(--text-secondary)] hidden sm:table-cell">
        {metrics.cac != null ? formatValue(metrics.cac) : "—"}
      </td>
    </tr>
  );
}

function PartnerPerformance({
  partners,
  formatValue,
}: {
  partners: ReportData["channels"]["byPartner"];
  formatValue: (v: number) => string;
}) {
  const totalPartnerMRR = partners.reduce((s, p) => s + p.totalMRR, 0);

  return (
    <GlassCard>
      <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Partner Performance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider border-b border-[var(--border-subtle)]">
              <th className="pb-2 font-medium">Partner</th>
              <th className="pb-2 font-medium text-right">Customers</th>
              <th className="pb-2 font-medium text-right">Total MRR</th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">
                % of Partner MRR
              </th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">
                Avg MRR
              </th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">
                New Logos
              </th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr
                key={p.partner}
                className="border-b border-[var(--border-subtle)] last:border-b-0"
              >
                <td className="py-2.5 text-[var(--text-primary)] font-medium">
                  {p.partner}
                </td>
                <td className="py-1.5 text-right metric-value">
                  {p.customerCount}
                </td>
                <td className="py-1.5 text-right metric-value">
                  {formatValue(p.totalMRR)}
                </td>
                <td className="py-1.5 text-right text-[var(--text-secondary)] hidden sm:table-cell">
                  {totalPartnerMRR > 0
                    ? `${Math.round((p.totalMRR / totalPartnerMRR) * 1000) / 10}%`
                    : "—"}
                </td>
                <td className="py-1.5 text-right text-[var(--text-secondary)] hidden sm:table-cell">
                  {formatValue(p.avgMRR)}
                </td>
                <td className="py-1.5 text-right text-[var(--text-secondary)] hidden sm:table-cell">
                  {p.newLogos > 0 ? p.newLogos : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
