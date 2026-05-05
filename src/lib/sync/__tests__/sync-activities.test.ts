/**
 * Tests for syncActivities() return value (SyncModuleResult).
 *
 * vi.mock() calls are hoisted by vitest, so we use vi.hoisted() to create
 * the supabase mock before the mock factories execute.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mocks before vi.mock() factories ────────────────────────────────
const { client, mocks } = vi.hoisted(() => {
  const from = vi.fn();
  const select = vi.fn();
  const insert = vi.fn();
  const upsert = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const eq = vi.fn();
  const neq = vi.fn();
  const inFn = vi.fn();
  const gte = vi.fn();
  const lte = vi.fn();
  const order = vi.fn();
  const limit = vi.fn();
  const single = vi.fn();
  const maybeSingle = vi.fn();

  const mocks = {
    from,
    select,
    insert,
    upsert,
    update,
    delete: del,
    eq,
    neq,
    in: inFn,
    gte,
    lte,
    order,
    limit,
    single,
    maybeSingle,
  };

  const client = { from };
  return { client, mocks };
});

// ── Mock fetchAllActivities ────────────────────────────────────────────────
const fetchAllActivitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hubspot-activities", () => ({
  fetchAllActivities: fetchAllActivitiesMock,
}));

// ── Mock Supabase admin ────────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// Import after mocks
import { syncActivities } from "../sync-activities";

// ── Chain wiring ──────────────────────────────────────────────────────────

function wireChain() {
  vi.clearAllMocks();

  // Wire upsert to return { error: null } by default (success)
  mocks.upsert.mockResolvedValue({ error: null });

  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });
}

const NO_ERRORS = { calls: null, meetings: null, emails: null, owners: null };

beforeEach(() => {
  wireChain();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("syncActivities() SyncModuleResult", () => {
  const MONTH = "2025-05";

  it("1. empty activities → recordsFetched=0, recordsUpserted=0, all metadata zeros", async () => {
    fetchAllActivitiesMock.mockResolvedValue({ activities: [], errors: NO_ERRORS });

    const result = await syncActivities(MONTH);

    expect(result.recordsFetched).toBe(0);
    expect(result.recordsUpserted).toBe(0);
    expect(result.metadata).toMatchObject({
      calls: 0,
      meetings: 0,
      emails: 0,
      ownerCount: 0,
    });
  });

  it("2. two activity records → recordsUpserted=2 (no server-side aggregation)", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "Alice", calls: 2, meetings: 1, emails: 0 },
        { date: "2025-05-02", ownerId: "owner1", ownerName: "Alice", calls: 3, meetings: 0, emails: 1 },
      ],
      errors: NO_ERRORS,
    });

    const result = await syncActivities(MONTH);

    expect(result.recordsUpserted).toBe(2);
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
  });

  it("3. aggregation totals: calls=15, meetings=6, emails=1", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "Alice", calls: 5, meetings: 1, emails: 0 },
        { date: "2025-05-02", ownerId: "owner1", ownerName: "Alice", calls: 10, meetings: 2, emails: 0 },
        { date: "2025-05-03", ownerId: "owner2", ownerName: "Bob",   calls: 0, meetings: 3, emails: 1 },
      ],
      errors: NO_ERRORS,
    });

    const result = await syncActivities(MONTH);

    expect(result.recordsFetched).toBe(15 + 6 + 1);
    expect(result.recordsUpserted).toBe(3);
    expect(result.metadata).toMatchObject({
      calls: 15,
      meetings: 6,
      emails: 1,
    });
  });

  it("4. two distinct owners → metadata.ownerCount=2", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "Alice", calls: 1, meetings: 0, emails: 0 },
        { date: "2025-05-01", ownerId: "owner2", ownerName: "Bob",   calls: 0, meetings: 1, emails: 0 },
      ],
      errors: NO_ERRORS,
    });

    const result = await syncActivities(MONTH);

    expect(result.metadata?.ownerCount).toBe(2);
  });

  it("5. upsert error → exception propagates", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "Alice", calls: 1, meetings: 0, emails: 0 },
      ],
      errors: NO_ERRORS,
    });

    mocks.upsert.mockResolvedValue({ error: { message: "DB write failed" } });

    await expect(syncActivities(MONTH)).rejects.toThrow("DB write failed");
  });

  it("6. partial-success: emails 403 but calls + meetings work → still upserts, errors in metadata", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "Alice", calls: 5, meetings: 2, emails: 0 },
      ],
      errors: {
        calls: null,
        meetings: null,
        emails: "HubSpot API error 403: MISSING_SCOPES",
        owners: null,
      },
    });

    const result = await syncActivities(MONTH);

    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      calls: 5,
      meetings: 2,
      emails: 0,
      sourceErrors: {
        emails: expect.stringContaining("403"),
      },
    });
  });

  it("7. all sources fail → throws", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [],
      errors: {
        calls: "HubSpot API error 500",
        meetings: "HubSpot API error 500",
        emails: "HubSpot API error 500",
        owners: null,
      },
    });

    await expect(syncActivities(MONTH)).rejects.toThrow(/all activity sources failed/i);
  });

  it("8. owners fetch fails but activities work → succeeds, owners error in metadata", async () => {
    fetchAllActivitiesMock.mockResolvedValue({
      activities: [
        { date: "2025-05-01", ownerId: "owner1", ownerName: "owner1", calls: 1, meetings: 0, emails: 0 },
      ],
      errors: { ...NO_ERRORS, owners: "HubSpot API error 403: owners scope missing" },
    });

    const result = await syncActivities(MONTH);

    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata?.sourceErrors).toMatchObject({
      owners: expect.stringContaining("403"),
    });
  });
});
