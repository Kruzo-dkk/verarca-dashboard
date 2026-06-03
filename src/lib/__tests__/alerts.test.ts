import { describe, it, expect } from "vitest";
import { detectAlerts } from "@/lib/alerts";

const base = {
  month: "2026-06",
  current: { mrr: 1_000_000, nrr: 110, churnedMrrEvent: 0 },
  prevMrr: 1_000_000,
  churnAvg3mo: 50_000,
  churnedCustomers: [],
};

describe("detectAlerts", () => {
  it("flags an MRR drop (critical >2%)", () => {
    const a = detectAlerts({ ...base, current: { ...base.current, mrr: 950_000 } });
    expect(a.find((x) => x.rule === "mrr_drop")?.severity).toBe("critical");
  });

  it("flags a churn spike vs 3mo avg", () => {
    const a = detectAlerts({ ...base, current: { ...base.current, churnedMrrEvent: 200_000 } });
    expect(a.some((x) => x.rule === "churn_spike")).toBe(true);
  });

  it("flags NRR below 100", () => {
    const a = detectAlerts({ ...base, current: { ...base.current, nrr: 92 } });
    expect(a.find((x) => x.rule === "nrr_below_100")?.severity).toBe("critical");
  });

  it("flags a big customer churn with a per-customer rule key", () => {
    const a = detectAlerts({
      ...base,
      churnedCustomers: [{ handle: "cust-9", name: "Big Co", mrr: 800_000 }],
    });
    expect(a.some((x) => x.rule === "big_customer_churn:cust-9")).toBe(true);
  });

  it("no alerts on a healthy month", () => {
    expect(detectAlerts(base)).toEqual([]);
  });
});
