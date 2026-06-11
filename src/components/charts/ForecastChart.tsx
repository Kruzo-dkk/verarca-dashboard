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
import {
  SCENARIO_ORDER,
  SCENARIO_DRAW_ORDER,
  SCENARIO_META,
  gradientId,
  type ScenarioId,
} from "@/lib/forecast-scenarios";

interface ForecastChartProps {
  data: ForecastResult;
  formatValue: (v: number) => string;
}

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

  // Add projection data — one key per scenario
  for (const scenario of SCENARIO_ORDER) {
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

  // Connect historical to projections: anchor every scenario at the last
  // historical MRR for the transition month so each line meets the "Now" point.
  if (lastHistoricalMonth && data.historical.length > 0) {
    const lastMRR = data.historical[data.historical.length - 1].mrr;
    const histEntry = chartData.find((d) => d.month === lastHistoricalMonth);
    if (histEntry) {
      for (const s of SCENARIO_ORDER) {
        histEntry[s] = lastMRR;
      }
    }
  }

  return (
    <ResponsiveContainer width="100%" height={mobile ? 240 : 320}>
      <AreaChart data={chartData} margin={margin}>
        <defs>
          {SCENARIO_DRAW_ORDER.map((s) => (
            <linearGradient key={s} id={gradientId(s)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCENARIO_META[s].color} stopOpacity={s === "predicted" ? 0.22 : 0.12} />
              <stop offset="95%" stopColor={SCENARIO_META[s].color} stopOpacity={0} />
            </linearGradient>
          ))}
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
            const n = (name ?? "") as string;
            if (n === "historical") return [formatValue(v), "Actual"];
            const meta = SCENARIO_META[n as ScenarioId];
            return [formatValue(v), meta ? meta.label : n.charAt(0).toUpperCase() + n.slice(1)];
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

        {/* Scenario projections — bands first, predicted last so it sits on top */}
        {SCENARIO_DRAW_ORDER.map((s) => {
          const isPredicted = s === "predicted";
          return (
            <Area
              key={s}
              type="monotone"
              dataKey={s}
              stroke={SCENARIO_META[s].color}
              fill={`url(#${gradientId(s)})`}
              strokeWidth={isPredicted ? 2.5 : 1.5}
              strokeDasharray={isPredicted ? undefined : "6 3"}
              isAnimationActive={false}
              connectNulls={false}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}
