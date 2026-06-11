/**
 * Forecast scenario catalogue — display metadata and constants shared by the
 * forecast API route and the forecast UI.
 *
 * The model has four scenarios:
 *   - `predicted` — auto-derived live from trailing actuals (read-only)
 *   - `worst` / `better` / `best` — editable bands suggested around predicted
 */

export type ScenarioId = "predicted" | "worst" | "better" | "best";

/** Editable bands (suggested around predicted, user-correctable). */
export const BAND_SCENARIOS = ["worst", "better", "best"] as const;
export type BandScenarioId = (typeof BAND_SCENARIOS)[number];

/** Display order for columns / summary cards: predicted first, then bands. */
export const SCENARIO_ORDER: readonly ScenarioId[] = [
  "predicted",
  "worst",
  "better",
  "best",
];

/** Chart draw order: bands first, predicted last so its line sits on top. */
export const SCENARIO_DRAW_ORDER: readonly ScenarioId[] = [
  "worst",
  "better",
  "best",
  "predicted",
];

export interface ScenarioMeta {
  label: string;
  /** Concrete colour (hex) — used for chart strokes/gradients and dots. */
  color: string;
  /** Short description shown on the summary cards. */
  desc: string;
  /** Predicted is auto-derived and not editable. */
  readOnly: boolean;
}

export const SCENARIO_META: Record<ScenarioId, ScenarioMeta> = {
  predicted: {
    label: "Predicted",
    color: "#0d9488", // teal — the auto-derived baseline
    desc: "Auto-derived from your trailing actuals",
    readOnly: true,
  },
  worst: {
    label: "Worst",
    color: "#ef4444", // red
    desc: "Higher churn, slower growth",
    readOnly: false,
  },
  better: {
    label: "Better",
    color: "#3b82f6", // blue
    desc: "Lower churn, faster growth",
    readOnly: false,
  },
  best: {
    label: "Best",
    color: "#22c55e", // green
    desc: "Best-case retention and growth",
    readOnly: false,
  },
};

/** Stable id for a scenario's chart area gradient. */
export function gradientId(scenario: ScenarioId): string {
  return `forecast-grad-${scenario}`;
}

/** Trailing-window options (months) for deriving the predicted scenario. */
export const PREDICTED_WINDOW_OPTIONS = [3, 6, 12] as const;
export const DEFAULT_PREDICTED_WINDOW = 6;
