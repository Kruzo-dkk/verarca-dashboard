/**
 * Tests for syncPipeline() — verifies it returns SyncModuleResult with
 * recordsFetched, recordsUpserted, and metadata fields.
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

// ── Mock Supabase admin ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// ── Mock HubSpot module ───────────────────────────────────────────────────
// calculatePipelineMetrics is a pure function — we import the real one via
// vi.importActual so tests exercise real metric logic without network calls.
vi.mock("@/lib/hubspot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hubspot")>();
  return {
    listDeals: vi.fn(),
    getPipelineStages: vi.fn(),
    calculatePipelineMetrics: actual.calculatePipelineMetrics,
    buildStoredDeals: actual.buildStoredDeals,
  };
});

import { syncPipeline } from "../sync-pipeline";
import { listDeals, getPipelineStages } from "@/lib/hubspot";
import type { HubSpotDeal, PipelineStage } from "@/lib/hubspot";
import { buildHubSpotDeal, buildPipelineStage } from "@/test/mocks/hubspot";

function wireChain() {
  const queryChain = {
    eq: mocks.eq,
    neq: mocks.neq,
    in: mocks.in,
    gte: mocks.gte,
    lte: mocks.lte,
    order: mocks.order,
    limit: mocks.limit,
    single: mocks.single,
    maybeSingle: mocks.maybeSingle,
  };

  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });

  mocks.select.mockReturnValue(queryChain);
  mocks.eq.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.neq.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.in.mockReturnValue({ data: [], error: null });
  mocks.gte.mockReturnValue(queryChain);
  mocks.lte.mockReturnValue(queryChain);
  mocks.order.mockReturnValue({ ...queryChain, data: [], error: null });
  mocks.limit.mockReturnValue({ data: [], error: null });
  mocks.single.mockResolvedValue({ data: null, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockReturnValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
}

beforeEach(() => {
  vi.clearAllMocks();
  wireChain();
});

describe("syncPipeline", () => {
  it("empty deals list → returns recordsFetched=0, recordsUpserted=1 and zero metric counts", async () => {
    vi.mocked(listDeals).mockResolvedValue([]);
    vi.mocked(getPipelineStages).mockResolvedValue([]);

    const result = await syncPipeline("2026-05");

    expect(result.recordsFetched).toBe(0);
    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      dealsWon: 0,
      dealsLost: 0,
      dealsOpen: 0,
      totalPipelineValue: 0,
      weightedPipeline: 0,
      winRate: 0,
    });
    // Upsert was called once
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("multiple deals → metadata contains correct won/lost/open counts", async () => {
    // Won stage: isClosed + probability=1.0
    const wonStage = buildPipelineStage({
      stageId: "closedwon",
      label: "Closed Won",
      metadata: { probability: "1.0", isClosed: "true" },
    });
    // Lost stage: isClosed + probability=0.0
    const lostStage = buildPipelineStage({
      stageId: "closedlost",
      label: "Closed Lost",
      metadata: { probability: "0.0", isClosed: "true" },
    });
    // Open stage
    const openStage = buildPipelineStage({
      stageId: "contractsent",
      label: "Contract Sent",
      metadata: { probability: "0.8", isClosed: "false" },
    });

    const wonDeal = buildHubSpotDeal({
      dealstage: "closedwon",
      amount: "100000",
      closedate: "2026-05-10T00:00:00Z",
      createdate: "2026-04-01T00:00:00Z",
    });
    const lostDeal = buildHubSpotDeal({
      dealstage: "closedlost",
      amount: "50000",
      closedate: "2026-05-15T00:00:00Z",
      createdate: "2026-04-01T00:00:00Z",
    });
    const openDeal = buildHubSpotDeal({
      dealstage: "contractsent",
      amount: "75000",
      createdate: "2026-04-01T00:00:00Z",
    });

    // calculatePipelineMetrics uses `isClosed` and `probability` from stages
    // The real PipelineStage type has `probability: number` (already parsed)
    // but buildPipelineStage puts probability in metadata. We need proper stage objects.
    const stages = [
      { stageId: "closedwon", label: "Closed Won", displayOrder: 4, probability: 1.0, isClosed: true },
      { stageId: "closedlost", label: "Closed Lost", displayOrder: 5, probability: 0.0, isClosed: true },
      { stageId: "contractsent", label: "Contract Sent", displayOrder: 3, probability: 0.8, isClosed: false },
    ];

    vi.mocked(listDeals).mockResolvedValue([wonDeal, lostDeal, openDeal] as unknown as HubSpotDeal[]);
    vi.mocked(getPipelineStages).mockResolvedValue(stages as PipelineStage[]);

    const result = await syncPipeline("2026-05");

    expect(result.recordsFetched).toBe(3);
    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      dealsWon: 1,
      dealsLost: 1,
      dealsOpen: 1,
    });
  });

  it("HubSpot fetch error → exception propagates", async () => {
    vi.mocked(listDeals).mockRejectedValue(new Error("API down"));
    vi.mocked(getPipelineStages).mockResolvedValue([]);

    await expect(syncPipeline("2026-05")).rejects.toThrow("API down");
  });

  it("Supabase upsert error → exception propagates with error message", async () => {
    vi.mocked(listDeals).mockResolvedValue([]);
    vi.mocked(getPipelineStages).mockResolvedValue([]);
    mocks.upsert.mockResolvedValue({ error: { message: "DB connection failed" } });

    await expect(syncPipeline("2026-05")).rejects.toThrow("DB connection failed");
  });
});
