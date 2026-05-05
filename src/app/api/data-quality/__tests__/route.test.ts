/**
 * Tests for the HubSpot-specific fields added to GET /api/data-quality.
 *
 * Covers: hubspotSyncHealth, hubspotMatchRate, hubspotApiStatus.
 *
 * All existing fields are present in the response — we only assert on the new ones.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist all mock functions before vi.mock() factories ──────────────────────
// vi.mock() is hoisted to the top of the file by vitest; variables declared
// at module scope are NOT yet defined when the factory runs.  vi.hoisted()
// lets us create the fns first so the factories can close over them.

const {
  mockAuthGetUser,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockLimit,
  mockMaybeSingle,
  mockEqMaybeSingle,
  mockHubspotFetch,
  mockListSubscriptions,
} = vi.hoisted(() => {
  const mockAuthGetUser = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  // Used ONLY by the sync_runs chain: select().eq().order().limit().maybeSingle()
  const mockMaybeSingle = vi.fn();
  // Used by the eq() return value directly: select().eq().maybeSingle()
  // (e.g. monthly_snapshots). Resolves with null data so it doesn't interfere.
  const mockEqMaybeSingle = vi.fn();
  const mockHubspotFetch = vi.fn();
  const mockListSubscriptions = vi.fn();

  return {
    mockAuthGetUser,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockLimit,
    mockMaybeSingle,
    mockEqMaybeSingle,
    mockHubspotFetch,
    mockListSubscriptions,
  };
});

// ─── Mock: supabase server (auth) ────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: mockAuthGetUser,
      },
    }),
}));

// ─── Mock: supabase admin (DB queries) ───────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ─── Mock: frisbii ────────────────────────────────────────────────────────────
vi.mock("@/lib/frisbii", () => ({
  listSubscriptions: (...args: unknown[]) => mockListSubscriptions(...args),
}));

// ─── Mock: hubspot ────────────────────────────────────────────────────────────
vi.mock("@/lib/hubspot", () => ({
  hubspotFetch: (...args: unknown[]) => mockHubspotFetch(...args),
}));

// Import AFTER mocks are registered
import { GET, __resetHubSpotApiStatusCache } from "../route";
import type { NextRequest } from "next/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/data-quality") as unknown as NextRequest;
}

/**
 * Wire a minimal chain for mock supabase.
 *
 * The route uses several different query patterns:
 *   1. select().eq().maybeSingle()                  — monthly_snapshots
 *   2. select().eq().eq()                            — customer_snapshots list
 *   3. select().eq().order().limit()                 — sync_audit_log
 *   4. select({count,head}).not().is()               — scope/tier override counts
 *   5. select({count,head}).eq().eq()                — customer_snapshots count
 *   6. select(cols).eq(mod).order().limit().maybeSingle() — sync_runs (new)
 */
function wireChain() {
  // mockEqMaybeSingle: used by eq() direct termination (e.g. monthly_snapshots).
  // Returns null data — doesn't interfere with sync_runs mock sequences.
  mockEqMaybeSingle.mockResolvedValue({ data: null, error: null });

  // mockMaybeSingle: used ONLY by the sync_runs chain (order → limit → maybeSingle).
  // Tests override this with mockResolvedValueOnce for each module.
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  // limit returns { maybeSingle, data, error }
  mockLimit.mockReturnValue({
    maybeSingle: mockMaybeSingle,
    data: [],
    error: null,
  });

  // order returns { limit, data, error }
  mockOrder.mockReturnValue({
    limit: mockLimit,
    data: [],
    error: null,
  });

  // eq returns a chain: supports eq().eq(), eq().order(), eq().maybeSingle()
  // eq().maybeSingle() uses mockEqMaybeSingle (NOT mockMaybeSingle) so existing
  // queries don't consume the sync_runs mockResolvedValueOnce queue.
  mockEq.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockEqMaybeSingle,
    data: [],
    error: null,
    count: 0,
  });
}

/**
 * Set up the existing-fields queries that the route runs in its main Promise.all.
 */
function setupExistingQueries() {
  // mockFrom returns { select } for all tables
  mockFrom.mockReturnValue({ select: mockSelect });

  // mockSelect returns a chain supporting all patterns
  mockSelect.mockReturnValue({
    eq: mockEq,
    not: vi.fn().mockReturnValue({
      is: vi.fn().mockResolvedValue({ count: 0, error: null }),
    }),
    order: mockOrder,
    data: null,
    error: null,
    count: null,
  });
}

/**
 * Build a fake sync_runs row for a given module name.
 */
function buildSyncRunRow(dbModule: string, metadata: Record<string, unknown> | null = null) {
  return {
    module: dbModule,
    status: "success",
    started_at: "2026-05-01T06:00:00.000Z",
    finished_at: "2026-05-01T06:01:00.000Z",
    duration_ms: 60000,
    records_fetched: 100,
    records_upserted: 95,
    error_message: null,
    metadata,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/data-quality — HubSpot fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear the module-level API status cache so each test starts fresh
    __resetHubSpotApiStatusCache();

    // Auth: authenticated user by default
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null,
    });

    // Frisbii: return empty list (existing fields pass through)
    mockListSubscriptions.mockResolvedValue([]);

    // Wire query chains
    wireChain();
    setupExistingQueries();

    // subscription_exclusions: the try-catch in the route catches any error
    // We just need the admin.from('subscription_exclusions').select() chain to work
    // It's called after the main Promise.all; mockFrom already returns { select: mockSelect }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: Happy path — 4 sync_runs rows → hubspotSyncHealth has 4 entries
  // ─────────────────────────────────────────────────────────────────────────────
  it("returns 4 hubspotSyncHealth entries with correct module name mapping", async () => {
    // Each of the 4 sync_runs queries resolves with a row
    mockMaybeSingle
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-pipeline"), error: null })
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-activities"), error: null })
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-tickets"), error: null })
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-customers"), error: null });

    // HubSpot probe succeeds
    mockHubspotFetch.mockResolvedValue({ results: [{}] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    const health: Array<{ module: string; status: string; startedAt: string }> =
      body.hubspotSyncHealth;

    expect(health).toHaveLength(4);

    // Verify module name mapping (sync-* → bare name)
    const modules = health.map((h) => h.module);
    expect(modules).toContain("pipeline");
    expect(modules).toContain("activities");
    expect(modules).toContain("tickets");
    expect(modules).toContain("customers");

    // Verify field renaming (started_at → startedAt, etc.)
    const pipeline = health.find((h) => h.module === "pipeline")!;
    expect(pipeline.startedAt).toBe("2026-05-01T06:00:00.000Z");
    expect(pipeline.status).toBe("success");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: hubspotMatchRate computed correctly from sync-customers metadata
  // ─────────────────────────────────────────────────────────────────────────────
  it("computes hubspotMatchRate correctly from sync-customers metadata", async () => {
    const customerMetadata = {
      matchedHubSpot: 80,
      unmatchedHubSpot: 20,
      clickupHigh: 30,
      clickupMedium: 40,
      clickupLow: 30,
    };

    mockMaybeSingle
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-pipeline"), error: null })
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-activities"), error: null })
      .mockResolvedValueOnce({ data: buildSyncRunRow("sync-tickets"), error: null })
      .mockResolvedValueOnce({
        data: buildSyncRunRow("sync-customers", customerMetadata),
        error: null,
      });

    mockHubspotFetch.mockResolvedValue({ results: [{}] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hubspotMatchRate).toEqual({
      total: 100,
      matched: 80,
      rate: 0.8,
      byConfidence: { high: 30, medium: 40, low: 30 },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: hubspotApiStatus.ok=true when probe succeeds
  // ─────────────────────────────────────────────────────────────────────────────
  it("sets hubspotApiStatus.ok=true when HubSpot probe succeeds", async () => {
    // No sync_runs rows
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Probe succeeds
    mockHubspotFetch.mockResolvedValue({ results: [{}] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hubspotApiStatus).toEqual({ ok: true, error: null });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: hubspotApiStatus.ok=false when probe throws — response is still 200
  // ─────────────────────────────────────────────────────────────────────────────
  it("sets hubspotApiStatus.ok=false when probe throws — response is still 200", async () => {
    // No sync_runs rows
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Probe fails
    mockHubspotFetch.mockRejectedValue(new Error("HubSpot API error 401: Unauthorized"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hubspotApiStatus.ok).toBe(false);
    expect(body.hubspotApiStatus.error).toContain("401");
  });
});
