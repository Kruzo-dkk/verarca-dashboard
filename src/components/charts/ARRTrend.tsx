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
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_AXIS_PROPS_MOBILE, CHART_MARGIN, CHART_MARGIN_MOBILE } from "./ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ARRTrendProps {
  data: { month: string; arr: number }[];
  formatValue: (v: number) => string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a YYYY-MM string for the X-axis.
 * Shows "Jan '24" for January or when the dataset spans multiple years,
 * otherwise just "Feb", "Mar", etc.
 */
function formatMonthTick(m: string, spansMultipleYears: boolean): string {
  const [yr, mo] = m.split("-");
  const monthName = MONTH_NAMES[parseInt(mo) - 1] ?? m;
  // Always show year suffix on January, or on all ticks if data spans multiple years
  if (spansMultipleYears || mo === "01") {
    return `${monthName} '${yr.slice(2)}`;
  }
  return monthName;
}

export function ARRTrend({ data, formatValue }: ARRTrendProps) {
  const mobile = useIsMobile();
  const axisProps = mobile ? CHART_AXIS_PROPS_MOBILE : CHART_AXIS_PROPS;
  const margin = mobile ? CHART_MARGIN_MOBILE : CHART_MARGIN;

  // Edge case: not enough data for a meaningful chart
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height: mobile ? 220 : 280 }}
      >
        {data.length === 0
          ? "No ARR data available. Run a sync to populate data."
          : "Only 1 month of data. More months needed for a trend."}
      </div>
    );
  }

  // Determine if the dataset spans multiple calendar years
  const years = new Set(data.map((d) => d.month.split("-")[0]));
  const spansMultipleYears = years.size > 1;

  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id="arrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis
          dataKey="month"
          {...axisProps}
          interval={mobile ? "equidistantPreserveStart" : undefined}
          tickFormatter={(m: string) => formatMonthTick(m, spansMultipleYears)}
        />
        <YAxis {...axisProps} tickFormatter={(v: number) => formatValue(v)} width={mobile ? 50 : undefined} />
        <Tooltip
          contentStyle={{
            background: CHART_COLORS.tooltipBg,
            border: `1px solid ${CHART_COLORS.grid}`,
            borderRadius: "0.5rem",
          }}
          labelStyle={{ color: "#1A1A1A" }}
          labelFormatter={(label) => {
            const m = String(label);
            const [yr, mo] = m.split("-");
            return `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
          }}
          formatter={(value: number | undefined) => [formatValue(value ?? 0), "ARR"]}
        />
        <Area
          type="monotone"
          dataKey="arr"
          stroke={CHART_COLORS.blue}
          strokeWidth={2}
          fill="url(#arrGradient)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
