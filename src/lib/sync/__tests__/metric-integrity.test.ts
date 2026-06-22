import { describe, it, expect } from "vitest";
import {
  nrrGrrProblems,
  mrrWaterfallExpected,
  arrArpaProblems,
  forecastRateProblems,
  conflictingLinkPairs,
  duplicateActiveSubGroups,
  expansionAnomaly,
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


describe("conflictingLinkPairs", () => {
  it("returns [] for a clean DAG of links", () => {
    expect(
      conflictingLinkPairs([
        { canonical_handle: "c", linked_handle: "a" },
        { canonical_handle: "c", linked_handle: "b" },
      ])
    ).toEqual([]);
  });
  it("flags a bidirectional conflict once (the Aluline bug)", () => {
    const r = conflictingLinkPairs([
      { canonical_handle: "cust-0191", linked_handle: "cust-0189" },
      { canonical_handle: "cust-0189", linked_handle: "cust-0191" },
      { canonical_handle: "cust-0191", linked_handle: "cust-0190" },
    ]);
    expect(r).toEqual(["cust-0189↔cust-0191"]);
  });
});

describe("duplicateActiveSubGroups", () => {
  it("flags a same-CVR identical pair as a true duplicate (lmpihl)", () => {
    const rows = [
      { frisbiiHandle: "cust-0073", cvr: "47982715", planHandle: "c-mellem", mrr: 459900 },
      { frisbiiHandle: "cust-0081", cvr: "47982715", planHandle: "c-mellem", mrr: 459900 },
    ];
    const groups = duplicateActiveSubGroups(
      rows,
      new Map([["cust-0081", "cust-0073"]])
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      canonicalHandle: "cust-0073",
      mrr: 459900,
      sameCvr: true,
    });
    expect(groups[0].handles.sort()).toEqual(["cust-0073", "cust-0081"]);
  });

  it("marks a cross-CVR identical pair as sameCvr:false (Madsen-Kastberg / Tina)", () => {
    const rows = [
      { frisbiiHandle: "cust-0178", cvr: "25709802", planHandle: "a-b-mikro", mrr: 149900 },
      { frisbiiHandle: "cust-0179", cvr: "29222169", planHandle: "a-b-mikro", mrr: 149900 },
    ];
    const groups = duplicateActiveSubGroups(
      rows,
      new Map([["cust-0178", "cust-0179"]])
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].sameCvr).toBe(false);
  });

  it("does NOT flag same-CVR same-plan but DIFFERENT amount (Consensus)", () => {
    const rows = [
      { frisbiiHandle: "cust-0016", cvr: "29194475", planHandle: "b-scope", mrr: 119900 },
      { frisbiiHandle: "cust-0079", cvr: "29194475", planHandle: "b-scope", mrr: 219900 },
    ];
    const groups = duplicateActiveSubGroups(
      rows,
      new Map([["cust-0079", "cust-0016"]])
    );
    expect(groups).toEqual([]);
  });

  it("does not flag two unlinked customers (separate canonicals)", () => {
    const rows = [
      { frisbiiHandle: "cust-0001", cvr: "111", planHandle: "p", mrr: 1000 },
      { frisbiiHandle: "cust-0002", cvr: "111", planHandle: "p", mrr: 1000 },
    ];
    expect(duplicateActiveSubGroups(rows, new Map())).toEqual([]);
  });

  it("sorts same-CVR duplicates before cross-CVR groups", () => {
    const rows = [
      { frisbiiHandle: "cust-0178", cvr: "25709802", planHandle: "a-b-mikro", mrr: 149900 },
      { frisbiiHandle: "cust-0179", cvr: "29222169", planHandle: "a-b-mikro", mrr: 149900 },
      { frisbiiHandle: "cust-0073", cvr: "47982715", planHandle: "c-mellem", mrr: 459900 },
      { frisbiiHandle: "cust-0081", cvr: "47982715", planHandle: "c-mellem", mrr: 459900 },
    ];
    const links = new Map([
      ["cust-0178", "cust-0179"],
      ["cust-0081", "cust-0073"],
    ]);
    const groups = duplicateActiveSubGroups(rows, links);
    expect(groups[0].sameCvr).toBe(true);
  });
});

describe("expansionAnomaly", () => {
  it("flags a spike far above the floor (the 40.281 stale artifact)", () => {
    expect(expansionAnomaly(4_028_100, 0).anomalous).toBe(true);
  });

  it("passes normal ~0 / below-floor expansion", () => {
    expect(expansionAnomaly(0, 0).anomalous).toBe(false);
    expect(expansionAnomaly(160_000, 50_000).anomalous).toBe(false);
  });

  it("uses 3× trailing avg when it exceeds the floor", () => {
    const r = expansionAnomaly(5_000_000, 2_000_000); // threshold = max(1M, 6M) = 6M
    expect(r.threshold).toBe(6_000_000);
    expect(r.anomalous).toBe(false);
  });
});
