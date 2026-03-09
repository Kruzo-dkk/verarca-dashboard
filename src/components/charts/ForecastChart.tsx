"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_AXIS_PROPS_MOBILE, CHART_MARGIN, CHART_MARGIN_MOBILE } from "@/components/charts/ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { ForecastResult } from "@/lib/forecast";

interface ForecastChartProps {
  data: ForecastResult;
  formatValue: (v: number) => string;
}

const SCENARIO_COLORS = {
  best: { stroke: "#10b981", fill: "#10b981" },   // emerald
  base: { stroke: "#1A5C5A", fill: "#1A5C5A" },   // teal (brand)
  worst: { stroke: "#ef4444", fill: "#ef4444" },   // red
};

export function ForecastChart({ data, formatValue }: ForecastChartProps) {
  const mobile = useIsMobile();
  const axisProps = mobile ? CHART_AXIS_PROPS_MOBILE : CHART_AXIS_PROPS;
  const margin = mobile ? CHART_MARGIN_MOBILE : CHART_MARGIN;

  // Build combined dataset: historical + projections
  const chartData: Record<string, unknown>[] = [];

  // Add historical data
  for (const h of data.historical) {
    chartData.push({
      month: formatMonthShort(h.month),
      rawMonth: h.month,
      historical: h.mrr,
      isHistorical: true,
    });
  }

  // Get the last historical month for the reference line
  const lastHistoricalMonth = data.historical.length > 0
    ? formatMonthShort(data.historical[data.historical.length - 1].month)
    : null;

  // Add projection data
  const scenarioOrder = ["best", "base", "worst"];
  for (const scenario of scenarioOrder) {
    const projection = data.projections.find((p) => p.scenario === scenario);
    if (!projection) continue;

    for (const m of projection.months) {
      const monthLabel = formatMonthShort(m.month);
      let existing = chartData.find((d) => d.month === monthLabel);
      if (!existing) {
        existing = { month: monthLabel, rawMonth: m.month, isHistorical: false };
        chartData.push(existing);
      }
      existing[scenario] = m.mrr;
    }
  }

  // Sort by rawMonth
  chartData.sort((a, b) =>
    String(a.rawMonth).localeCompare(String(b.rawMonth))
  );

  // Connect historical to projections: set base scenario = last historical for the transition month
  if (lastHistoricalMonth && data.historical.length > 0) {
    const lastMRR = data.historical[data.historical.length - 1].mrr;
    const histEntry = chartData.find((d) => d.month === lastHistoricalMonth);
    if (histEntry) {
      histEntry.best = lastMRR;
      histEntry.base = lastMRR;
      histEntry.worst = lastMRR;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={mobile ? 240 : 320}>
      <AreaChart data={chartData} margin={margin}>
        <defs>
          <linearGradient id="bestGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SCENARIO_COLORS.best.fill} stopOpacity={0.15} />
            <stop offset="95%" stopColor={SCENARIO_COLORS.best.fill} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="baseGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SCENARIO_COLORS.base.fill} stopOpacity={0.25} />
            <stop offset="95%" stopColor={SCENARIO_COLORS.base.fill} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="worstGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={SCENARIO_COLORS.worst.fill} stopOpacity={0.1} />
            <stop offset="95%" stopColor={SCENARIO_COLORS.worst.fill} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis
          dataKey="month"
          {...axisProps}
          interval={mobile ? "equidistantPreserveStart" : "preserveStartEnd"}
        />
        <YAxis
          {...axisProps}
          tickFormatter={(v: number) => formatValue(v)}
          width={mobile ? 50 : undefined}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            fontSize: "12px",
          }}
          formatter={(value?: number, name?: string) => {
            const v = value ?? 0;
            const n = name ?? "";
            return [
              formatValue(v),
              n === "historical" ? "Actual" : n.charAt(0).toUpperCase() + n.slice(1),
            ];
          }}
        />

        {/* Reference line at transition point */}
        {lastHistoricalMonth && (
          <ReferenceLine
            x={lastHistoricalMonth}
            stroke="var(--text-muted)"
            strokeDasharray="4 4"
            label={{ value: "Now", position: "top", fill: "var(--text-muted)", fontSize: 11 }}
          />
        )}

        {/* Historical MRR */}
        <Area
          type="monotone"
          dataKey="historical"
          stroke="#6366f1"
          fill="url(#historicalGradient)"
          strokeWidth={2.5}
          isAnimationActive={false}
          connectNulls={false}
        />

        {/* Scenario projections — render worst first so best overlays on top */}
        <Area
          type="monotone"
          dataKey="worst"
          stroke={SCENARIO_COLORS.worst.stroke}
          fill="url(#worstGradient)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="base"
          stroke={SCENARIO_COLORS.base.stroke}
          fill="url(#baseGradient)"
          strokeWidth={2}
          strokeDasharray="6 3"
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="best"
          stroke={SCENARIO_COLORS.best.stroke}
          fill="url(#bestGradient)"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          isAnimationActive={false}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
