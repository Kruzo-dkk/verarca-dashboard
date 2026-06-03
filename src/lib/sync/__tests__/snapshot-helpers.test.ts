import { describe, it, expect } from "vitest";
import { wasActiveDuringMonth } from "@/lib/sync/snapshot-helpers";
import { buildSubscription } from "@/test/mocks/frisbii";

describe("wasActiveDuringMonth", () => {
  it("includes a currently-active sub activated before the month", () => {
    const sub = buildSubscription({ state: "active", activated: "2025-01-01T00:00:00Z" });
    expect(wasActiveDuringMonth(sub, "2025-06")).toBe(true);
  });

  it("excludes a sub activated after the month ends", () => {
    const sub = buildSubscription({ state: "active", activated: "2025-07-15T00:00:00Z" });
    expect(wasActiveDuringMonth(sub, "2025-06")).toBe(false);
  });

  it("excludes a ghost: non-active with no end date", () => {
    const sub = buildSubscription({
      state: "cancelled",
      activated: "2025-01-01T00:00:00Z",
      expired_date: undefined,
      cancelled_date: undefined,
    });
    expect(wasActiveDuringMonth(sub, "2025-06")).toBe(false);
  });

  it("includes a cancelled sub that ended during/after the month", () => {
    const sub = buildSubscription({
      state: "cancelled",
      activated: "2025-01-01T00:00:00Z",
      expired_date: "2025-06-20T00:00:00Z",
    });
    expect(wasActiveDuringMonth(sub, "2025-06")).toBe(true);
  });

  it("excludes a cancelled sub that ended before the month started", () => {
    const sub = buildSubscription({
      state: "cancelled",
      activated: "2025-01-01T00:00:00Z",
      expired_date: "2025-05-31T00:00:00Z",
    });
    expect(wasActiveDuringMonth(sub, "2025-06")).toBe(false);
  });
});
