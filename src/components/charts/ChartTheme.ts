/** Shared Recharts theme – aligned with Verarca brand */

export const CHART_COLORS = {
  // Verarca brand accents
  cyan: "#0693e3",     // primary accent (verarca cyan-blue)
  teal: "#7bdcb5",     // secondary accent (verarca light green-cyan)
  emerald: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#0693e3",
  purple: "#8B5CF6",
  slate: "#6B7280",
  // Chart structural colors
  grid: "#32373c",
  text: "#9CA3AF",
  tooltipBg: "rgba(34, 38, 43, 0.95)",
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
  new: "#0693e3",       // verarca cyan for new MRR
  expansion: "#7bdcb5", // verarca teal for expansion
  contraction: "#F59E0B",
  churned: "#EF4444",
} as const;
