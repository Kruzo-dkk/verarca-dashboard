"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_COLORS, CHART_GRID_PROPS, CHART_AXIS_PROPS, CHART_AXIS_PROPS_MOBILE, CHART_MARGIN, CHART_MARGIN_MOBILE } from "./charts/ChartTheme";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatAmount } from "@/lib/currency";

interface ChurnDataPoint {
  month: string;
  churnRate: number;
  logoChurnRate: number;
  revenueChurnRate: number;
  expiredCount: number;
  activeAtStart: number;
  churnedMRR: number;
  startMRR: number;
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
          Logo churn:{" "}
          <span className="font-medium text-red-600">
            {d.logoChurnRate.toFixed(2)}%
          </span>{" "}
          <span className="text-xs">({d.expiredCount} of {d.activeAtStart})</span>
        </p>
        <p>
          Revenue churn:{" "}
          <span className="font-medium" style={{ color: CHART_COLORS.amber }}>
            {d.revenueChurnRate.toFixed(2)}%
          </span>{" "}
          <span className="text-xs">({formatAmount(d.churnedMRR, "DKK")})</span>
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
        Monthly Churn Rates
      </h3>
      <div className={mobile ? "h-[220px]" : "h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={margin}>
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
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="logoChurnRate"
              name="Logo"
              stroke={CHART_COLORS.red}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="revenueChurnRate"
              name="Revenue"
              stroke={CHART_COLORS.amber}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
