/** Shared Recharts dark theme configuration */

export const CHART_COLORS = {
  emerald: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  slate: "#64748B",
  grid: "#1E293B",
  text: "#94A3B8",
  tooltipBg: "rgba(17, 24, 39, 0.95)",
} as const;

export const CHART_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: CHART_COLORS.grid,
  vertical: false,
} as const;

export const CHART_AXIS_PROPS = {
  tick: { fill: CHART_COLORS.text, fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;

export const CHART_MARGIN = {
  top: 10,
  right: 10,
  left: 10,
  bottom: 0,
} as const;

/** MRR Waterfall colors */
export const WATERFALL_COLORS = {
  new: "#10B981",
  expansion: "#06B6D4",
  contraction: "#F59E0B",
  churned: "#EF4444",
} as const;
