"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_AXIS_PROPS_MOBILE, CHART_MARGIN, CHART_MARGIN_MOBILE } from "./charts/ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ChurnDataPoint {
  month: string;
  churnRate: number;
  expiredCount: number;
  activeAtStart: number;
}

interface ChurnChartProps {
  data: ChurnDataPoint[];
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

interface TooltipPayloadEntry {
  payload: ChurnDataPoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip text-sm">
      <p className="font-medium text-[var(--text-primary)] mb-1.5">{formatMonth(d.month)}</p>
      <div className="space-y-1 text-[var(--text-secondary)]">
        <p>
          Churn rate:{" "}
          <span className="font-medium text-red-600">
            {d.churnRate.toFixed(2)}%
          </span>
        </p>
        <p>
          Churned:{" "}
          <span className="font-medium text-[var(--text-primary)]">{d.expiredCount}</span>{" "}
          subscriptions
        </p>
        <p>
          Active at start:{" "}
          <span className="font-medium text-[var(--text-primary)]">{d.activeAtStart}</span>
        </p>
      </div>
    </div>
  );
}

export function ChurnChart({ data }: ChurnChartProps) {
  const mobile = useIsMobile();
  const axisProps = mobile ? CHART_AXIS_PROPS_MOBILE : CHART_AXIS_PROPS;
  const margin = mobile ? CHART_MARGIN_MOBILE : CHART_MARGIN;

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="glass-card p-3 sm:p-6">
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">
        Monthly Churn Rate
      </h3>
      <div className={mobile ? "h-[220px]" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={margin}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="label"
              {...axisProps}
            />
            <YAxis
              {...axisProps}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              width={mobile ? 40 : undefined}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="churnRate"
              fill={CHART_COLORS.red}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
