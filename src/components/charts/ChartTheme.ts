/** Shared Recharts theme – aligned with Verarca brand (light) */

export const CHART_COLORS = {
  // Verarca brand accents
  coral: "#FF6B4A",      // primary accent (verarca coral/salmon)
  teal: "#1A5C5A",       // secondary accent (verarca deep teal)
  emerald: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#1A5C5A",       // use teal for line charts
  purple: "#7C3AED",
  slate: "#6B7280",
  // Chart structural colors – light theme
  grid: "#E8E8E8",
  text: "#8A8A8A",
  tooltipBg: "#FFFFFF",
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
  new: "#1A5C5A",       // verarca teal for new MRR
  expansion: "#FF6B4A", // verarca coral for expansion
  contraction: "#F59E0B",
  churned: "#EF4444",
} as const;
