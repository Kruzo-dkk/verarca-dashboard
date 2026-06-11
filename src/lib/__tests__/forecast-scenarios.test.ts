import { describe, it, expect } from "vitest";
import {
  SCENARIO_ORDER,
  SCENARIO_DRAW_ORDER,
  BAND_SCENARIOS,
  SCENARIO_META,
  gradientId,
  PREDICTED_WINDOW_OPTIONS,
  DEFAULT_PREDICTED_WINDOW,
} from "../forecast-scenarios";

describe("forecast-scenarios constants", () => {
  it("has four scenarios in display order", () => {
    expect(SCENARIO_ORDER).toEqual(["worst", "predicted", "better", "best"]);
  });

  it("draws bands first and predicted last (overlay on top)", () => {
    expect(SCENARIO_DRAW_ORDER).toHaveLength(4);
    expect(SCENARIO_DRAW_ORDER[SCENARIO_DRAW_ORDER.length - 1]).toBe("predicted");
    // same set as SCENARIO_ORDER, different order
    expect([...SCENARIO_DRAW_ORDER].sort()).toEqual([...SCENARIO_ORDER].sort());
  });

  it("exposes the three editable band scenarios only", () => {
    expect(BAND_SCENARIOS).toEqual(["worst", "better", "best"]);
    expect(BAND_SCENARIOS).not.toContain("predicted");
  });

  it("marks only predicted as read-only", () => {
    expect(SCENARIO_META.predicted.readOnly).toBe(true);
    for (const s of BAND_SCENARIOS) {
      expect(SCENARIO_META[s].readOnly).toBe(false);
    }
  });

  it("gives every scenario a label and color", () => {
    for (const s of SCENARIO_ORDER) {
      expect(SCENARIO_META[s].label.length).toBeGreaterThan(0);
      expect(SCENARIO_META[s].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("builds gradient ids from scenario name", () => {
    expect(gradientId("best")).toBe("bestGradient");
    expect(gradientId("predicted")).toBe("predictedGradient");
  });

  it("offers 3/6/12 window options with a default of 6", () => {
    expect(PREDICTED_WINDOW_OPTIONS).toEqual([3, 6, 12]);
    expect(DEFAULT_PREDICTED_WINDOW).toBe(6);
    expect(PREDICTED_WINDOW_OPTIONS).toContain(DEFAULT_PREDICTED_WINDOW);
  });
});
