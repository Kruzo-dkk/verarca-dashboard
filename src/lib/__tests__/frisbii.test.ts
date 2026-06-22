import { describe, it, expect } from "vitest";
import { mapWithConcurrency, withRetry } from "../frisbii";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    let calls = 0;
    const r = await withRetry(async () => {
      calls++;
      return "ok";
    }, 3, 0);
    expect(r).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("429 rate limited");
        return "ok";
      },
      3,
      0
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });

  it("THROWS after exhausting retries — never silently defaults", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("boom");
      }, 2, 0)
    ).rejects.toThrow("boom");
    expect(calls).toBe(3); // initial + 2 retries
  });
});

describe("mapWithConcurrency", () => {
  it("processes every item, preserving input order", async () => {
    const r = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(r).toEqual([10, 20, 30, 40]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 1;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // actually parallelised
  });

  it("propagates a task error (does not swallow)", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("task failed");
        return n;
      })
    ).rejects.toThrow("task failed");
  });

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async (n) => n)).toEqual([]);
  });
});
