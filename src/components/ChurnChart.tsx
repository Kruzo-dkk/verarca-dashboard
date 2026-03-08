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
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm shadow-xl">
      <p className="font-medium text-white mb-1.5">{formatMonth(d.month)}</p>
      <div className="space-y-1 text-zinc-300">
        <p>
          Churn rate:{" "}
          <span className="font-medium text-red-400">
            {d.churnRate.toFixed(2)}%
          </span>
        </p>
        <p>
          Churned:{" "}
          <span className="font-medium text-white">{d.expiredCount}</span>{" "}
          subscriptions
        </p>
        <p>
          Active at start:{" "}
          <span className="font-medium text-white">{d.activeAtStart}</span>
        </p>
      </div>
    </div>
  );
}

export function ChurnChart({ data }: ChurnChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Monthly Churn Rate
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="label"
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="churnRate"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
