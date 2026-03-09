"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { WATERFALL_COLORS, CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_AXIS_PROPS_MOBILE, CHART_MARGIN, CHART_MARGIN_MOBILE } from "./ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { MRRDecomposition } from "@/lib/metrics";

interface MRRWaterfallProps {
  decomposition: MRRDecomposition;
  formatValue: (v: number) => string;
}

export function MRRWaterfall({ decomposition, formatValue }: MRRWaterfallProps) {
  const mobile = useIsMobile();
  const axisProps = mobile ? CHART_AXIS_PROPS_MOBILE : CHART_AXIS_PROPS;
  const margin = mobile ? CHART_MARGIN_MOBILE : CHART_MARGIN;

  const data = [
    { name: "New", value: decomposition.newMRR, fill: WATERFALL_COLORS.new },
    { name: "Expansion", value: decomposition.expansionMRR, fill: WATERFALL_COLORS.expansion },
    { name: "Contraction", value: -decomposition.contractionMRR, fill: WATERFALL_COLORS.contraction },
    { name: "Churned", value: -decomposition.churnedMRR, fill: WATERFALL_COLORS.churned },
    { name: "Net New", value: decomposition.netNewMRR, fill: decomposition.netNewMRR >= 0 ? WATERFALL_COLORS.new : WATERFALL_COLORS.churned },
  ];

  return (
    <ResponsiveContainer width="100%" height={mobile ? 220 : 280}>
      <BarChart data={data} margin={margin}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v: number) => formatValue(Math.abs(v))} width={mobile ? 50 : undefined} />
        <Tooltip
          contentStyle={{
            background: CHART_COLORS.tooltipBg,
            border: `1px solid ${CHART_COLORS.grid}`,
            borderRadius: "0.5rem",
          }}
          labelStyle={{ color: "#1A1A1A" }}
          itemStyle={{ color: CHART_COLORS.text }}
          formatter={(value: number | undefined) => [formatValue(Math.abs(value ?? 0)), ""]}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          fill="#10B981"
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <rect key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
