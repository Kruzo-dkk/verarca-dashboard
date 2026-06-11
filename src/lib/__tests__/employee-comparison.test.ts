import { describe, it, expect } from "vitest";
import {
  computeEmployeeComparison,
  type ComparableDeal,
  type OwnerActivityTotal,
} from "../employee-comparison";

const NOW = Date.parse("2026-06-11T00:00:00Z");
const resolveName = (id: string) => `Name(${id})`;

function deal(overrides: Partial<ComparableDeal> = {}): ComparableDeal {
  return {
    ownerId: "o1",
    amount: 100_00,
    probability: 0.5,
    isClosed: false,
    isWon: false,
    createdDate: "2026-06-01T00:00:00Z", // 10 days before NOW
    ...overrides,
  };
}

describe("computeEmployeeComparison", () => {
  it("aggregates open/won/lost metrics and activities per owner", () => {
    const deals: ComparableDeal[] = [
      deal({ ownerId: "o1", amount: 100_00, probability: 0.5 }), // open
      deal({ ownerId: "o1", amount: 300_00, probability: 0.2 }), // open
      deal({ ownerId: "o1", amount: 500_00, isClosed: true, isWon: true }), // won
      deal({ ownerId: "o1", amount: 200_00, isClosed: true, isWon: false }), // lost
    ];
    const activities: OwnerActivityTotal[] = [
      { ownerId: "o1", ownerName: "Kasper", totalActivities: 42 },
    ];

    const [row] = computeEmployeeComparison(deals, activities, resolveName, NOW);

    expect(row.ownerName).toBe("Kasper");
    expect(row.openDealCount).toBe(2);
    expect(row.openPipelineValue).toBe(400_00);
    // 10000*0.5 + 30000*0.2 = 5000 + 6000
    expect(row.weightedPipeline).toBe(11_000);
    expect(row.dealsWon).toBe(1);
    expect(row.mrrClosed).toBe(500_00);
    expect(row.winRate).toBe(0.5); // 1 won / 2 closed
    expect(row.totalActivities).toBe(42);
    expect(row.avgDealAgeDays).toBe(10);
  });

  it("includes owners that have activity but no deals", () => {
    const rows = computeEmployeeComparison(
      [],
      [{ ownerId: "o2", ownerName: "Mette", totalActivities: 7 }],
      resolveName,
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ownerId: "o2",
      ownerName: "Mette",
      openDealCount: 0,
      openPipelineValue: 0,
      weightedPipeline: 0,
      avgDealAgeDays: null,
      dealsWon: 0,
      mrrClosed: 0,
      winRate: 0,
      totalActivities: 7,
    });
  });

  it("includes owners that have deals but no activity row (name via resolveName, activities 0)", () => {
    const rows = computeEmployeeComparison(
      [deal({ ownerId: "o3" })],
      [],
      resolveName,
      NOW
    );
    expect(rows[0].ownerName).toBe("Name(o3)");
    expect(rows[0].totalActivities).toBe(0);
  });

  it("returns null avg age when no open deal has a createdate, and averages over present ones", () => {
    const allNull = computeEmployeeComparison(
      [deal({ createdDate: null }), deal({ createdDate: null })],
      [],
      resolveName,
      NOW
    );
    expect(allNull[0].avgDealAgeDays).toBeNull();

    const mixed = computeEmployeeComparison(
      [
        deal({ createdDate: "2026-06-01T00:00:00Z" }), // 10 days
        deal({ createdDate: null }),
        deal({ createdDate: "2026-05-22T00:00:00Z" }), // 20 days
      ],
      [],
      resolveName,
      NOW
    );
    expect(mixed[0].avgDealAgeDays).toBe(15); // (10 + 20) / 2
  });

  it("ignores deals with no ownerId (no empty-string owner row)", () => {
    const rows = computeEmployeeComparison(
      [deal({ ownerId: null }), deal({ ownerId: null })],
      [],
      resolveName,
      NOW
    );
    expect(rows).toHaveLength(0);
  });

  it("win rate is 0 (not NaN) when there are deals but none closed", () => {
    const rows = computeEmployeeComparison(
      [deal({ ownerId: "o4", isClosed: false })],
      [],
      resolveName,
      NOW
    );
    expect(rows[0].winRate).toBe(0);
  });

  it("sorts by open pipeline value descending", () => {
    const rows = computeEmployeeComparison(
      [
        deal({ ownerId: "small", amount: 100_00 }),
        deal({ ownerId: "big", amount: 900_00 }),
      ],
      [],
      resolveName,
      NOW
    );
    expect(rows.map((r) => r.ownerId)).toEqual(["big", "small"]);
  });

  it("returns an empty array for empty inputs", () => {
    expect(computeEmployeeComparison([], [], resolveName, NOW)).toEqual([]);
  });
});
