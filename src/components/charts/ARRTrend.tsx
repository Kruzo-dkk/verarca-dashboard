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

export function ARRTrend({ data, formatValue }: ARRTrendProps) {
  const mobile = useIsMobile();
  const axisProps = mobile ? CHART_AXIS_PROPS_MOBILE : CHART_AXIS_PROPS;
  const margin = mobile ? CHART_MARGIN_MOBILE : CHART_MARGIN;

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
          tickFormatter={(m: string) => {
            const [, mo] = m.split("-");
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return monthNames[parseInt(mo) - 1] ?? m;
          }}
        />
        <YAxis {...axisProps} tickFormatter={(v: number) => formatValue(v)} width={mobile ? 50 : undefined} />
        <Tooltip
          contentStyle={{
            background: CHART_COLORS.tooltipBg,
            border: `1px solid ${CHART_COLORS.grid}`,
            borderRadius: "0.5rem",
          }}
          labelStyle={{ color: "#1A1A1A" }}
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
