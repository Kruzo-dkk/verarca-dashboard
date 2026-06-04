import { describe, it, expect } from "vitest";
import {
  detectARRStage,
  getBenchmarksForStage,
  getAllBenchmarksForStage,
  benchmarkColor,
  BENCHMARK_DATA,
  BENCHMARK_METRICS,
  ARR_STAGES,
  ARR_STAGE_LABELS,
} from "../benchmarks";

// ─── detectARRStage ──────────────────────────────────────────────

describe("detectARRStage", () => {
  it("returns '0-1M' for ARR below $1M USD equivalent", () => {
    // < $1M USD → need ARR in DKK øre: $1M / 0.15 = ~6.67M DKK = 666_666_666 øre
    // So anything below that → "0-1M"
    expect(detectARRStage(0)).toBe("0-1M");
    expect(detectARRStage(100_000_000)).toBe("0-1M"); // ~$150K USD
  });

  it("returns '1-5M' for ARR $1-5M USD equivalent", () => {
    // $1M = 1_000_000 / 0.15 = 6_666_667 DKK = 666_666_700 øre
    // $3M = 3_000_000 / 0.15 = 20_000_000 DKK = 2_000_000_000 øre
    expect(detectARRStage(2_000_000_000)).toBe("1-5M");
  });

  it("returns '5-10M' for ARR $5-10M USD equivalent", () => {
    // $7M = 7_000_000 / 0.15 = 46_666_667 DKK = 4_666_666_700 øre
    expect(detectARRStage(4_666_666_700)).toBe("5-10M");
  });

  it("returns '10-25M' for ARR $10-25M USD equivalent", () => {
    // $15M = 15_000_000 / 0.15 = 100_000_000 DKK = 10_000_000_000 øre
    expect(detectARRStage(10_000_000_000)).toBe("10-25M");
  });

  it("returns '25-50M' for ARR $25-50M USD equivalent", () => {
    // $30M = 30_000_000 / 0.15 = 200_000_000 DKK = 20_000_000_000 øre
    expect(detectARRStage(20_000_000_000)).toBe("25-50M");
  });

  it("clamps ARR above $50M to '25-50M' (highest stage with benchmark data)", () => {
    // $60M = 60_000_000 / 0.15 = 400_000_000 DKK = 40_000_000_000 øre
    expect(detectARRStage(40_000_000_000)).toBe("25-50M");
  });
});

// ─── getBenchmarksForStage ────────────────────────────────────────

describe("getBenchmarksForStage", () => {
  it("returns benchmark data for a valid source and stage", () => {
    const result = getBenchmarksForStage("bessemer", "1-5M");
    expect(result).not.toBeNull();
    expect(result!.stage).toBe("1-5M");
    expect(result!.metrics.nrr).toEqual({ median: 100, topQuartile: 115 });
  });

  it("returns data for 0-1M stage", () => {
    const result = getBenchmarksForStage("bessemer", "0-1M");
    expect(result).not.toBeNull();
    expect(result!.stage).toBe("0-1M");
  });

  it("returns null for an invalid source", () => {
    const result = getBenchmarksForStage(
      "nonexistent" as Parameters<typeof getBenchmarksForStage>[0],
      "1-5M"
    );
    expect(result).toBeNull();
  });

  it("returns different data for different sources at the same stage", () => {
    const bessemer = getBenchmarksForStage("bessemer", "5-10M");
    const openview = getBenchmarksForStage("openview", "5-10M");

    expect(bessemer).not.toBeNull();
    expect(openview).not.toBeNull();
    // They may have different median NRR values
    expect(bessemer!.metrics.nrr!.median).not.toEqual(
      openview!.metrics.nrr!.median
    );
  });
});

// ─── getAllBenchmarksForStage ─────────────────────────────────────

describe("getAllBenchmarksForStage", () => {
  it("returns all 3 sources for a commonly supported stage", () => {
    const results = getAllBenchmarksForStage("10-25M");
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.source)).toContain("bessemer");
    expect(results.map((r) => r.source)).toContain("openview");
    expect(results.map((r) => r.source)).toContain("keybanc");
  });

  it("returns all sources for 0-1M stage", () => {
    const results = getAllBenchmarksForStage("0-1M");
    expect(results).toHaveLength(3);
  });
});

// ─── benchmarkColor ──────────────────────────────────────────────

describe("benchmarkColor", () => {
  const benchmark = { median: 100, topQuartile: 120 };

  describe("higher is better (e.g., NRR)", () => {
    it("returns emerald for values at or above top quartile", () => {
      expect(benchmarkColor(120, benchmark, true)).toBe("text-emerald-600");
      expect(benchmarkColor(150, benchmark, true)).toBe("text-emerald-600");
    });

    it("returns amber for values between median and top quartile", () => {
      expect(benchmarkColor(100, benchmark, true)).toBe("text-amber-600");
      expect(benchmarkColor(110, benchmark, true)).toBe("text-amber-600");
    });

    it("returns red for values below median", () => {
      expect(benchmarkColor(99, benchmark, true)).toBe("text-red-600");
      expect(benchmarkColor(50, benchmark, true)).toBe("text-red-600");
    });
  });

  describe("lower is better (e.g., CAC payback)", () => {
    const paybackBenchmark = { median: 20, topQuartile: 12 };

    it("returns emerald for values at or below top quartile", () => {
      expect(benchmarkColor(12, paybackBenchmark, false)).toBe("text-emerald-600");
      expect(benchmarkColor(8, paybackBenchmark, false)).toBe("text-emerald-600");
    });

    it("returns amber for values between top quartile and median", () => {
      expect(benchmarkColor(15, paybackBenchmark, false)).toBe("text-amber-600");
      expect(benchmarkColor(20, paybackBenchmark, false)).toBe("text-amber-600");
    });

    it("returns red for values above median", () => {
      expect(benchmarkColor(21, paybackBenchmark, false)).toBe("text-red-600");
      expect(benchmarkColor(30, paybackBenchmark, false)).toBe("text-red-600");
    });
  });
});

// ─── Data integrity ──────────────────────────────────────────────

describe("BENCHMARK_DATA integrity", () => {
  it("has exactly 3 data sources", () => {
    expect(BENCHMARK_DATA).toHaveLength(3);
  });

  it("each source has at least 4 ARR stages", () => {
    for (const source of BENCHMARK_DATA) {
      expect(source.stages.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("every stage has NRR and GRR benchmarks", () => {
    for (const source of BENCHMARK_DATA) {
      for (const stage of source.stages) {
        expect(stage.metrics.nrr).toBeDefined();
        expect(stage.metrics.grr).toBeDefined();
      }
    }
  });

  it("all benchmark values have median <= topQuartile for higher-is-better metrics", () => {
    const higherIsBetter = Object.entries(BENCHMARK_METRICS)
      .filter(([, meta]) => meta.higherIsBetter)
      .map(([key]) => key);

    for (const source of BENCHMARK_DATA) {
      for (const stage of source.stages) {
        for (const key of higherIsBetter) {
          const val = stage.metrics[key as keyof typeof stage.metrics];
          if (val) {
            expect(
              val.topQuartile,
              `${source.source}/${stage.stage}/${key}: topQuartile should >= median`
            ).toBeGreaterThanOrEqual(val.median);
          }
        }
      }
    }
  });

  it("all benchmark values have median >= topQuartile for lower-is-better metrics", () => {
    const lowerIsBetter = Object.entries(BENCHMARK_METRICS)
      .filter(([, meta]) => !meta.higherIsBetter)
      .map(([key]) => key);

    for (const source of BENCHMARK_DATA) {
      for (const stage of source.stages) {
        for (const key of lowerIsBetter) {
          const val = stage.metrics[key as keyof typeof stage.metrics];
          if (val) {
            expect(
              val.topQuartile,
              `${source.source}/${stage.stage}/${key}: topQuartile should <= median`
            ).toBeLessThanOrEqual(val.median);
          }
        }
      }
    }
  });
});

describe("BENCHMARK_METRICS", () => {
  it("has 10 metric definitions", () => {
    expect(Object.keys(BENCHMARK_METRICS)).toHaveLength(10);
  });

  it("format functions produce expected output", () => {
    expect(BENCHMARK_METRICS.nrr.format(110)).toBe("110%");
    expect(BENCHMARK_METRICS.ltvCac.format(3.5)).toBe("3.5x");
    expect(BENCHMARK_METRICS.cacPayback.format(18)).toBe("18 mo");
    expect(BENCHMARK_METRICS.magicNumber.format(0.75)).toBe("0.75");
  });
});

describe("ARR_STAGES and ARR_STAGE_LABELS", () => {
  it("stages are in ascending order", () => {
    expect(ARR_STAGES).toEqual([
      "0-1M", "1-5M", "5-10M", "10-25M", "25-50M", "50M+",
    ]);
  });

  it("every stage has a label", () => {
    for (const stage of ARR_STAGES) {
      expect(ARR_STAGE_LABELS[stage]).toBeDefined();
      expect(typeof ARR_STAGE_LABELS[stage]).toBe("string");
    }
  });
});
