import { describe, it, expect } from "vitest";
import {
  convertFromDKK,
  convertUSDtoDKK,
  convertEURtoDKK,
  formatAmount,
  formatPercent,
  formatDelta,
  type FXRates,
} from "../currency";

const RATES: FXRates = { EUR: 0.134, USD: 0.145 };

// ─── convertFromDKK ──────────────────────────────────────────────

describe("convertFromDKK", () => {
  it("returns same amount for DKK (passthrough)", () => {
    expect(convertFromDKK(100_000, "DKK", RATES)).toBe(100_000);
  });

  it("converts DKK øre to EUR cents", () => {
    // 100,000 × 0.134 = 13,400
    expect(convertFromDKK(100_000, "EUR", RATES)).toBe(13_400);
  });

  it("converts DKK øre to USD cents", () => {
    // 100,000 × 0.145 = 14,500
    expect(convertFromDKK(100_000, "USD", RATES)).toBe(14_500);
  });

  it("rounds to nearest integer", () => {
    // 333 × 0.134 = 44.622 → 45
    expect(convertFromDKK(333, "EUR", RATES)).toBe(45);
  });
});

// ─── convertUSDtoDKK ─────────────────────────────────────────────

describe("convertUSDtoDKK", () => {
  it("converts USD cents to DKK øre", () => {
    // 1 DKK = 0.145 USD → 1 USD = 6.8966 DKK
    // 10,000 cents / 0.145 = 68,966
    expect(convertUSDtoDKK(10_000, RATES)).toBe(68_966);
  });

  it("returns 0 when rate is 0", () => {
    expect(convertUSDtoDKK(10_000, { EUR: 0.134, USD: 0 })).toBe(0);
  });
});

// ─── convertEURtoDKK ─────────────────────────────────────────────

describe("convertEURtoDKK", () => {
  it("converts EUR cents to DKK øre", () => {
    // 1 DKK = 0.134 EUR → 1 EUR = 7.4627 DKK
    // 10,000 / 0.134 = 74,627
    expect(convertEURtoDKK(10_000, RATES)).toBe(74_627);
  });

  it("returns 0 when rate is 0", () => {
    expect(convertEURtoDKK(10_000, { EUR: 0, USD: 0.145 })).toBe(0);
  });
});

// ─── formatAmount ────────────────────────────────────────────────

describe("formatAmount", () => {
  it("formats DKK with kr prefix and da-DK locale", () => {
    const result = formatAmount(123_456_789, "DKK");
    expect(result).toContain("kr");
    // 123,456,789 øre / 100 = 1,234,567.89 → rounds to 1,234,568
    expect(result).toContain("1.234.568");
  });

  it("formats EUR with € prefix", () => {
    const result = formatAmount(16_543_200, "EUR");
    expect(result).toContain("€");
  });

  it("formats USD with $ prefix", () => {
    const result = formatAmount(17_982_100, "USD");
    expect(result).toContain("$");
  });

  it("rounds to whole major units (no decimals)", () => {
    // 99 øre = 0.99 DKK → rounds to 1
    const result = formatAmount(99, "DKK");
    expect(result).toContain("1");
  });
});

// ─── formatPercent ───────────────────────────────────────────────

describe("formatPercent", () => {
  it("formats with default 1 decimal", () => {
    expect(formatPercent(8.34)).toBe("8.3%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercent(8.345, 2)).toBe("8.35%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

// ─── formatDelta ─────────────────────────────────────────────────

describe("formatDelta", () => {
  it("returns em-dash when previous is 0", () => {
    const result = formatDelta(100, 0);
    expect(result.text).toBe("\u2014");
    expect(result.neutral).toBe(true);
  });

  it("formats positive growth with up arrow", () => {
    const result = formatDelta(108, 100);
    expect(result.text).toContain("+");
    expect(result.text).toContain("↑");
    expect(result.positive).toBe(true);
    expect(result.neutral).toBe(false);
  });

  it("formats negative growth with down arrow", () => {
    const result = formatDelta(92, 100);
    expect(result.text).toContain("-");
    expect(result.text).toContain("↓");
    expect(result.positive).toBe(false);
  });

  it("formats zero change as neutral", () => {
    const result = formatDelta(100, 100);
    expect(result.text).toContain("+0.0%");
    expect(result.neutral).toBe(true);
  });
});
