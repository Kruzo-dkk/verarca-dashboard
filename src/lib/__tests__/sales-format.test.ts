import { describe, it, expect } from "vitest";
import {
  formatDKK,
  formatDate,
  formatDealAge,
  formatPercent01,
} from "../sales-format";

describe("formatDKK", () => {
  it("converts øre to kr with da-DK grouping and no decimals", () => {
    expect(formatDKK(123_456_700)).toBe("kr 1.234.567");
  });
  it("handles zero", () => {
    expect(formatDKK(0)).toBe("kr 0");
  });
});

describe("formatDate", () => {
  it("returns em dash for null/undefined/invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });
  it("formats an ISO date in da-DK short form", () => {
    expect(formatDate("2026-08-31")).toMatch(/aug/);
  });
});

describe("formatDealAge", () => {
  it("returns em dash when null/undefined", () => {
    expect(formatDealAge(null)).toBe("—");
    expect(formatDealAge(undefined)).toBe("—");
  });
  it("uses singular for 1 and plural otherwise", () => {
    expect(formatDealAge(1)).toBe("1 dag i forløb");
    expect(formatDealAge(12)).toBe("12 dage i forløb");
    expect(formatDealAge(0)).toBe("0 dage i forløb");
  });
});

describe("formatPercent01", () => {
  it("rounds a 0–1 decimal to whole percent", () => {
    expect(formatPercent01(0.426)).toBe("43%");
    expect(formatPercent01(0)).toBe("0%");
  });
  it("returns em dash when null/undefined", () => {
    expect(formatPercent01(null)).toBe("—");
    expect(formatPercent01(undefined)).toBe("—");
  });
});
