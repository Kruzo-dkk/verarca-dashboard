import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock chain builders ───────────────────────────────────────

const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

// sync_runs chain: .select().eq().eq().order().limit()
// or:             .select().eq().order().limit()
const mockSyncRunsLimit = vi.fn();
const mockSyncRunsOrder = vi.fn(() => ({ limit: mockSyncRunsLimit }));
const mockSyncRunsEq2 = vi.fn(() => ({ order: mockSyncRunsOrder, eq: mockSyncRunsEq2 }));
const mockSyncRunsEq1 = vi.fn(() => ({ eq: mockSyncRunsEq2, order: mockSyncRunsOrder }));
const mockSyncRunsSelect = vi.fn(() => ({ eq: mockSyncRunsEq1 }));

// monthly_snapshots / customer_snapshots chain: .select().eq().eq() / .select().in()
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();

mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
mockIn.mockReturnValue({ data: [], error: null });

const mockFrom = vi.fn((tableName: string) => {
  if (tableName === "sync_runs") {
    return { select: mockSyncRunsSelect };
  }
  if (tableName === "sync_audit_log") {
    return { insert: mockInsert };
  }
  // monthly_snapshots, customer_snapshots
  return { select: mockSelect, insert: mockInsert };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// Mock Frisbii
vi.mock("@/lib/frisbii", () => ({
  listSubscriptions: vi.fn().mockResolvedValue([]),
}));

import { validateSync } from "../validate-sync";
import { listSubscriptions } from "@/lib/frisbii";

beforeEach(() => {
  vi.clearAllMocks();

  // Re-wire sync_runs chain
  mockSyncRunsLimit.mockResolvedValue({ data: [], error: null });
  mockSyncRunsOrder.mockReturnValue({ limit: mockSyncRunsLimit });
  mockSyncRunsEq2.mockReturnValue({ order: mockSyncRunsOrder, eq: mockSyncRunsEq2 });
  mockSyncRunsEq1.mockReturnValue({ eq: mockSyncRunsEq2, order: mockSyncRunsOrder });
  mockSyncRunsSelect.mockReturnValue({ eq: mockSyncRunsEq1 });

  // Re-wire monthly_snapshots / customer_snapshots chain
  mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
  mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
  mockIn.mockReturnValue({ data: [], error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  mockInsert.mockReturnValue({ error: null });

  // Default frisbii
  vi.mocked(listSubscriptions).mockResolvedValue([]);

  // Re-wire mockFrom with fresh table routing
  mockFrom.mockImplementation((tableName: string) => {
    if (tableName === "sync_runs") {
      return { select: mockSyncRunsSelect };
    }
    if (tableName === "sync_audit_log") {
      return { insert: mockInsert };
    }
    return { select: mockSelect, insert: mockInsert };
  });
});

// ─── Existing tests ───────────────────────────────────────────

describe("validateSync", () => {
  it("writes check results to sync_audit_log", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await validateSync("2026-03");

    // Should insert all checks (5 original + 3 metric-integrity invariants +
    // the forecast predicted-rate identity)
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(9);
    expect(
      insertedRows.map((r: { check_name: string }) => r.check_name)
    ).toEqual(
      expect.arrayContaining([
        "mrr_reconciliation",
        "churn_spike",
        "delete_recreate",
        "hubspot_pipeline_health",
        "hubspot_match_rate",
        "nrr_grr_consistency",
        "mrr_waterfall_identity",
        "arr_arpa_identity",
        "forecast_predicted_rates",
      ])
    );
  });

  it("detects delete/recreate pattern", async () => {
    const now = new Date();
    const recentDate = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    vi.mocked(listSubscriptions).mockResolvedValue([
      {
        handle: "sub-old",
        state: "expired",
        customer: "cust-1",
        plan: "plan-1",
        quantity: 1,
        currency: "DKK",
        created: "2024-01-01T00:00:00Z",
        activated: "2024-01-01T00:00:00Z",
        expired_date: recentDate,
        plan_version: 1,
      },
      {
        handle: "sub-new",
        state: "active",
        customer: "cust-1",
        plan: "plan-1",
        quantity: 1,
        currency: "DKK",
        created: recentDate,
        activated: recentDate,
        plan_version: 1,
      },
    ]);

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const deleteRecreateCheck = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "delete_recreate"
    );
    expect(deleteRecreateCheck.status).toBe("warn");
    expect(deleteRecreateCheck.actual_value).toBe("1");

    const details = JSON.parse(deleteRecreateCheck.details);
    expect(details[0].customer).toBe("cust-1");
  });

  it("passes delete/recreate when no patterns found", async () => {
    vi.mocked(listSubscriptions).mockResolvedValue([
      {
        handle: "sub-active",
        state: "active",
        customer: "cust-1",
        plan: "plan-1",
        quantity: 1,
        currency: "DKK",
        created: "2024-01-01T00:00:00Z",
        activated: "2024-01-01T00:00:00Z",
        plan_version: 1,
      },
    ]);

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const deleteRecreateCheck = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "delete_recreate"
    );
    expect(deleteRecreateCheck.status).toBe("pass");
  });
});

// ─── checkHubSpotPipelineHealth ───────────────────────────────

describe("checkHubSpotPipelineHealth", () => {
  it("fails when no sync_runs row exists for sync-pipeline", async () => {
    // Default: mockSyncRunsLimit returns data: []
    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_pipeline_health"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("did not run in last 24h");
    expect(check.actual_value).toBeNull();
  });

  it("fails when latest sync-pipeline row is older than 24 hours", async () => {
    const staleDate = new Date(
      Date.now() - 25 * 60 * 60 * 1000
    ).toISOString();

    mockSyncRunsLimit.mockResolvedValueOnce({
      data: [
        {
          module: "sync-pipeline",
          started_at: staleDate,
          status: "success",
          records_fetched: 10,
          error_message: null,
          metadata: null,
        },
      ],
      error: null,
    });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_pipeline_health"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("did not run in last 24h");
  });

  it("fails when latest sync-pipeline row has status=failed", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit.mockResolvedValueOnce({
      data: [
        {
          module: "sync-pipeline",
          started_at: recentDate,
          status: "failed",
          records_fetched: null,
          error_message: "HubSpot API 429",
          metadata: null,
        },
      ],
      error: null,
    });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_pipeline_health"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("HubSpot API 429");
  });

  it("warns when sync-pipeline succeeded but fetched 0 deals", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit.mockResolvedValueOnce({
      data: [
        {
          module: "sync-pipeline",
          started_at: recentDate,
          status: "success",
          records_fetched: 0,
          error_message: null,
          metadata: null,
        },
      ],
      error: null,
    });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_pipeline_health"
    );
    expect(check.status).toBe("warn");
    expect(check.details).toContain("fetched 0 deals");
  });

  it("passes when sync-pipeline succeeded with records_fetched=42", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit.mockResolvedValueOnce({
      data: [
        {
          module: "sync-pipeline",
          started_at: recentDate,
          status: "success",
          records_fetched: 42,
          error_message: null,
          metadata: null,
        },
      ],
      error: null,
    });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_pipeline_health"
    );
    expect(check.status).toBe("pass");
    expect(check.actual_value).toBe("42");
  });
});

// ─── checkHubSpotMatchRate ────────────────────────────────────

describe("checkHubSpotMatchRate", () => {
  it("fails when no successful sync-customers row exists", async () => {
    // Both sync_runs queries return empty — pipeline check gets first call, match rate gets second
    // We need both to return empty arrays by default
    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_match_rate"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("No successful customers sync found");
    expect(check.actual_value).toBeNull();
  });

  it("fails when matchRate metadata is missing from sync-customers row", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // First call (pipeline check) returns empty; second call (match rate) returns row with no matchRate
    mockSyncRunsLimit
      .mockResolvedValueOnce({ data: [], error: null }) // pipeline
      .mockResolvedValueOnce({
        data: [
          {
            module: "sync-customers",
            started_at: recentDate,
            status: "success",
            records_fetched: 50,
            error_message: null,
            metadata: { someOtherField: true },
          },
        ],
        error: null,
      });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_match_rate"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("matchRate metadata missing");
  });

  it("passes when matchRate=0.85 (>= 0.7 threshold)", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit
      .mockResolvedValueOnce({ data: [], error: null }) // pipeline
      .mockResolvedValueOnce({
        data: [
          {
            module: "sync-customers",
            started_at: recentDate,
            status: "success",
            records_fetched: 50,
            error_message: null,
            metadata: { matchRate: 0.85 },
          },
        ],
        error: null,
      });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_match_rate"
    );
    expect(check.status).toBe("pass");
    expect(check.actual_value).toBe("0.85");
    expect(check.expected_value).toBe("0.7");
  });

  it("warns when matchRate=0.5 (>= 0.4 but < 0.7)", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit
      .mockResolvedValueOnce({ data: [], error: null }) // pipeline
      .mockResolvedValueOnce({
        data: [
          {
            module: "sync-customers",
            started_at: recentDate,
            status: "success",
            records_fetched: 50,
            error_message: null,
            metadata: { matchRate: 0.5 },
          },
        ],
        error: null,
      });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_match_rate"
    );
    expect(check.status).toBe("warn");
    expect(check.details).toContain("50%");
    expect(check.details).toContain("<70%");
  });

  it("fails when matchRate=0.2 (< 0.4)", async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    mockSyncRunsLimit
      .mockResolvedValueOnce({ data: [], error: null }) // pipeline
      .mockResolvedValueOnce({
        data: [
          {
            module: "sync-customers",
            started_at: recentDate,
            status: "success",
            records_fetched: 50,
            error_message: null,
            metadata: { matchRate: 0.2 },
          },
        ],
        error: null,
      });

    await validateSync("2026-03");

    const insertedRows = mockInsert.mock.calls[0][0];
    const check = insertedRows.find(
      (r: { check_name: string }) => r.check_name === "hubspot_match_rate"
    );
    expect(check.status).toBe("fail");
    expect(check.details).toContain("20%");
    expect(check.details).toContain("<40%");
  });
});
