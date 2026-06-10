/**
 * Shared forecast scenario constants — single source of truth for the four
 * forecast scenarios consumed by the API route, the assumptions grid, the
 * summary cards, and the projection chart.
 *
 * Scenarios:
 *   - predicted: auto-derived from trailing actuals + run-rate (read-only)
 *   - worst / better / best: suggested bands around predicted, user-correctable
 */

export type ScenarioId = "predicted" | "worst" | "better" | "best";

/** Left-to-right display order (cards, grid columns). Predicted is the centre line. */
export const SCENARIO_ORDER: ScenarioId[] = ["worst", "predicted", "better", "best"];

/** Chart paint order — bands first so predicted (and best) overlay on top. */
export const SCENARIO_DRAW_ORDER: ScenarioId[] = ["worst", "better", "best", "predicted"];

/** The editable, persistable scenarios. Predicted is never stored. */
export const BAND_SCENARIOS = ["worst", "better", "best"] as const;
export type BandScenario = (typeof BAND_SCENARIOS)[number];

export interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  color: string; // hex
  desc: string;
  readOnly: boolean; // predicted only
}

export const SCENARIO_META: Record<ScenarioId, ScenarioMeta> = {
  predicted: {
    id: "predicted",
    label: "Predicted",
    color: "#1A5C5A", // brand teal — the centre line
    desc: "Auto from trailing actuals + run-rate",
    readOnly: true,
  },
  worst: {
    id: "worst",
    label: "Worst",
    color: "#ef4444",
    desc: "Elevated churn, weak growth",
    readOnly: false,
  },
  better: {
    id: "better",
    label: "Better",
    color: "#3b82f6",
    desc: "Improved retention & acquisition",
    readOnly: false,
  },
  best: {
    id: "best",
    label: "Best",
    color: "#10b981",
    desc: "Low churn, strong expansion",
    readOnly: false,
  },
};

/** SVG gradient id for a scenario's chart area fill. */
export const gradientId = (id: ScenarioId): string => `${id}Gradient`;

/** Selectable trailing-window lengths (months) for the Predicted derivation. */
export const PREDICTED_WINDOW_OPTIONS = [3, 6, 12] as const;
export type PredictedWindow = (typeof PREDICTED_WINDOW_OPTIONS)[number];
export const DEFAULT_PREDICTED_WINDOW = 6;
