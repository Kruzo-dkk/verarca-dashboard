"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";
import { CHART_COLORS } from "./ChartTheme";

interface SparkLineProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export function SparkLine({ data, color = CHART_COLORS.emerald, height = 32 }: SparkLineProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
