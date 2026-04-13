import { describe, it, expect } from "vitest";
import {
  formatPlanName,
  inferSegmentFromPlan,
  inferScopeFromPlan,
  inferTierFromPlan,
} from "../format-plan-name";

// ─── formatPlanName ──────────────────────────────────────────────

describe("formatPlanName", () => {
  it("returns null for null/undefined/empty", () => {
    expect(formatPlanName(null)).toBeNull();
    expect(formatPlanName(undefined)).toBeNull();
    expect(formatPlanName("")).toBeNull();
  });

  it("resolves special plans by lookup", () => {
    expect(formatPlanName("prime-lcd")).toBe("Prime LCD");
    expect(formatPlanName("verarca-software-managed-carbon-service")).toBe(
      "Managed Carbon Service"
    );
    expect(formatPlanName("supported-carbon-service")).toBe(
      "Supported Carbon Service"
    );
  });

  it("special plan lookup is case-insensitive", () => {
    expect(formatPlanName("Prime-LCD")).toBe("Prime LCD");
  });

  it("handles year-suffixed plans (Samhandel2026)", () => {
    expect(formatPlanName("Samhandel2026")).toBe("Samhandel 2026");
  });

  // ─── Structured scope plans ──────────────────────────────────

  it("parses b-scope-1-2-3-standard", () => {
    expect(formatPlanName("b-scope-1-2-3-standard")).toBe("B · Scope 1-2-3");
  });

  it("parses c-mellem-scope-1-2-3-standard", () => {
    expect(formatPlanName("c-mellem-scope-1-2-3-standard")).toBe(
      "C Mellem · Scope 1-2-3"
    );
  });

  it("parses a-b-mikro-scope-1-2-3-standard", () => {
    expect(formatPlanName("a-b-mikro-scope-1-2-3-standard")).toBe(
      "A-B Mikro · Scope 1-2-3"
    );
  });

  it("parses samhandel-b-scope-1-2-standard", () => {
    expect(formatPlanName("samhandel-b-scope-1-2-standard")).toBe(
      "Samhandel · B · Scope 1-2"
    );
  });

  it("shows managed tier when not standard", () => {
    expect(formatPlanName("b-scope-1-2-3-managed")).toBe(
      "B · Scope 1-2-3 · Managed"
    );
  });

  it("omits standard tier (default)", () => {
    const name = formatPlanName("b-scope-1-2-standard");
    expect(name).not.toContain("Standard");
  });

  it("parses c-stor-scope-1-2-3-standard", () => {
    expect(formatPlanName("c-stor-scope-1-2-3-standard")).toBe(
      "C Stor · Scope 1-2-3"
    );
  });

  // ─── Fallback (hyphen-split + capitalize) ────────────────────

  it("falls back to capitalized hyphen-split for unknown patterns", () => {
    expect(formatPlanName("some-custom-plan")).toBe("Some Custom Plan");
  });
});

// ─── inferSegmentFromPlan ────────────────────────────────────────

describe("inferSegmentFromPlan", () => {
  it("returns Unknown for null", () => {
    expect(inferSegmentFromPlan(null)).toBe("Unknown");
  });

  it("detects B (Mikro) from mikro qualifier", () => {
    expect(inferSegmentFromPlan("a-b-mikro-scope-1-2-3-standard")).toBe(
      "B (Mikro)"
    );
  });

  it("detects C (Stor) from stor qualifier", () => {
    expect(inferSegmentFromPlan("c-stor-scope-1-2-3-standard")).toBe("C (Stor)");
  });

  it("detects C (Mellem) from mellem qualifier", () => {
    expect(inferSegmentFromPlan("c-mellem-scope-1-2-3-standard")).toBe(
      "C (Mellem)"
    );
  });

  it("detects B from bare b-scope prefix", () => {
    expect(inferSegmentFromPlan("b-scope-1-2-3-standard")).toBe("B");
  });

  it("detects B (Mikro) from a-scope prefix", () => {
    expect(inferSegmentFromPlan("a-scope-1-2-standard")).toBe("B (Mikro)");
  });

  it("detects C (Mellem) from bare c-scope prefix", () => {
    expect(inferSegmentFromPlan("c-scope-1-2-3-standard")).toBe("C (Mellem)");
  });

  it("strips samhandel prefix before classifying", () => {
    expect(inferSegmentFromPlan("samhandel-b-scope-1-2-standard")).toBe("B");
  });

  it("detects B (Mikro) from a-b prefix", () => {
    expect(inferSegmentFromPlan("a-b-scope-1-2-standard")).toBe("B (Mikro)");
  });

  it("returns B for bare scope- prefix", () => {
    expect(inferSegmentFromPlan("scope-1-2-3-standard")).toBe("B");
  });

  it("returns Unknown for unrecognized plans", () => {
    expect(inferSegmentFromPlan("prime-lcd")).toBe("Unknown");
  });
});

// ─── inferScopeFromPlan ──────────────────────────────────────────

describe("inferScopeFromPlan", () => {
  it("returns null for null/undefined", () => {
    expect(inferScopeFromPlan(null)).toBeNull();
    expect(inferScopeFromPlan(undefined)).toBeNull();
  });

  it("extracts scope-1-2-3", () => {
    expect(inferScopeFromPlan("b-scope-1-2-3-standard")).toBe("Scope 1-2-3");
  });

  it("extracts scope-1-2", () => {
    expect(inferScopeFromPlan("samhandel-b-scope-1-2-standard")).toBe(
      "Scope 1-2"
    );
  });

  it("returns null for non-scope plans", () => {
    expect(inferScopeFromPlan("prime-lcd")).toBeNull();
  });
});

// ─── inferTierFromPlan ───────────────────────────────────────────

describe("inferTierFromPlan", () => {
  it("returns null for null/undefined", () => {
    expect(inferTierFromPlan(null)).toBeNull();
    expect(inferTierFromPlan(undefined)).toBeNull();
  });

  it("detects Standard tier", () => {
    expect(inferTierFromPlan("b-scope-1-2-3-standard")).toBe("Standard");
  });

  it("detects Managed tier", () => {
    expect(inferTierFromPlan("b-scope-1-2-3-managed")).toBe("Managed");
    expect(inferTierFromPlan("verarca-software-managed-carbon-service")).toBe(
      "Managed"
    );
  });

  it("maps supported → Managed", () => {
    expect(inferTierFromPlan("supported-carbon-service")).toBe("Managed");
  });

  it("maps prime → Managed", () => {
    expect(inferTierFromPlan("prime-lcd")).toBe("Managed");
  });

  it("returns null when no tier is detectable", () => {
    expect(inferTierFromPlan("some-other-plan")).toBeNull();
  });
});
