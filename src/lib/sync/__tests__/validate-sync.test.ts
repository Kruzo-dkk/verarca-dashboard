import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

mockSelect.mockReturnValue({
  eq: mockEq,
  in: mockIn,
});

mockEq.mockReturnValue({
  eq: mockEq,
  maybeSingle: mockMaybeSingle,
});

mockIn.mockReturnValue({ data: [], error: null });
mockInsert.mockReturnValue({ error: null });

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

  // Reset chain mocks
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
  });
  mockSelect.mockReturnValue({
    eq: mockEq,
    in: mockIn,
  });
  mockEq.mockReturnValue({
    eq: mockEq,
    maybeSingle: mockMaybeSingle,
  });
  mockIn.mockReturnValue({ data: [], error: null });
  mockInsert.mockReturnValue({ error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("validateSync", () => {
  it("writes check results to sync_audit_log", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await validateSync("2026-03");

    // Should insert 3 checks (mrr_reconciliation, churn_spike, delete_recreate)
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(3);
    expect(insertedRows.map((r: { check_name: string }) => r.check_name)).toEqual(
      expect.arrayContaining([
        "mrr_reconciliation",
        "churn_spike",
        "delete_recreate",
      ])
    );
  });

  it("detects delete/recreate pattern", async () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString();

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
        expired: recentDate,
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
