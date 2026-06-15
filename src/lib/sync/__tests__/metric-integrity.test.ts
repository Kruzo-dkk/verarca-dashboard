import { describe, it, expect } from "vitest";
import {
  nrrGrrProblems,
  mrrWaterfallExpected,
  arrArpaProblems,
  forecastRateProblems,
} from "../validate-sync";

describe("nrrGrrProblems", () => {
  it("passes when NRR == GRR and there is no expansion", () => {
    expect(nrrGrrProblems(98.32, 98.32, 0)).toEqual([]);
  });

  it("passes when NRR > GRR and expansion > 0", () => {
    expect(nrrGrrProblems(102.6, 100, 282_400)).toEqual([]);
  });

  it("FLAGS the exact shipped bug: NRR > GRR with zero expansion", () => {
    const p = nrrGrrProblems(106.18, 98.32, 0);
    expect(p.length).toBeGreaterThan(0);
    expect(p[0]).toContain("expansion_mrr=0");
  });

  it("flags NRR < GRR (impossible)", () => {
    expect(nrrGrrProblems(98.51, 98.73, 0)[0]).toContain("impossible");
  });

  it("flags NRR == GRR while expansion > 0", () => {
    expect(nrrGrrProblems(100, 100, 5_000)[0]).toContain("expansion_mrr=5000");
  });
});

describe("mrrWaterfallExpected", () => {
  it("closes the May waterfall", () => {
    // prev 29,740,477 + new 1,898,900 − contraction 380,100 − churn 119,900
    expect(mrrWaterfallExpected(29_740_477, 1_898_900, 0, 380_100, 119_900)).toBe(
      31_139_377
    );
  });
});

describe("arrArpaProblems", () => {
  it("passes the identities", () => {
    expect(arrArpaProblems(1_000_000, 12_000_000, 10_000, 100)).toEqual([]);
  });
  it("flags arr ≠ mrr×12", () => {
    expect(arrArpaProblems(1_000_000, 999_999, 10_000, 100)[0]).toContain("mrr×12");
  });
  it("flags arpa ≠ mrr/count", () => {
    expect(arrArpaProblems(1_000_000, 12_000_000, 9_000, 100)[0]).toContain("mrr/count");
  });
});


describe("forecastRateProblems", () => {
  it("passes when derived rates match the independent recomputation", () => {
    expect(forecastRateProblems(3.0, 3.0, 1.5, 1.5)).toEqual([]);
    expect(forecastRateProblems(3.0, 3.02, 1.5, 1.48)).toEqual([]); // within tol
  });
  it("flags a drifted predicted churn rate", () => {
    const p = forecastRateProblems(3.0, 2.0, 1.5, 1.5);
    expect(p.length).toBe(1);
    expect(p[0]).toContain("predicted churn");
  });
  it("flags a drifted predicted expansion rate", () => {
    const p = forecastRateProblems(3.0, 3.0, 1.5, 0.0);
    expect(p.length).toBe(1);
    expect(p[0]).toContain("predicted expansion");
  });
});
