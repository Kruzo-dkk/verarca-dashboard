import { describe, it, expect } from "vitest";
import { previousMonth, isValidMonth, formatMonthLabel } from "@/lib/report-email";

describe("report-email helpers", () => {
  it("previousMonth rolls over the year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-06")).toBe("2026-05");
  });

  it("isValidMonth rejects bad formats", () => {
    expect(isValidMonth("2026-06")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-6")).toBe(false);
    expect(isValidMonth("June")).toBe(false);
  });

  it("formatMonthLabel renders a human label", () => {
    expect(formatMonthLabel("2026-06")).toBe("June 2026");
  });
});
