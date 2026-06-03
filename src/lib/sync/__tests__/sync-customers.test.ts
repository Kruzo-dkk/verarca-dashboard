/**
 * Tests for syncCustomers() – covers SyncModuleResult return,
 * explicit HubSpot error exposure, match counting, and null-strip guard.
 *
 * vi.mock() is hoisted, so the Supabase client is built inline via vi.hoisted()
 * following the same pattern as sync-monthly.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CompanyIndex } from "@/lib/hubspot-companies";

// ── Hoist mock client (cannot use imports inside vi.hoisted) ──────────────────
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

// ── Hoisted mock function references for frisbii / clickup / hubspot / match ──
const {
  mockListCustomers,
  mockListSubscriptions,
  mockListPlans,
  mockBuildPlanMap,
  mockGetAllCustomerData,
  mockGetAllCompanies,
  mockBuildCompanyIndex,
  mockMatchCustomerToHubSpot,
} = vi.hoisted(() => ({
  mockListCustomers: vi.fn(),
  mockListSubscriptions: vi.fn(),
  mockListPlans: vi.fn(),
  mockBuildPlanMap: vi.fn(),
  mockGetAllCustomerData: vi.fn(),
  mockGetAllCompanies: vi.fn(),
  mockBuildCompanyIndex: vi.fn(),
  mockMatchCustomerToHubSpot: vi.fn(),
}));

// ── vi.mock() declarations (hoisted by vitest) ────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

vi.mock("@/lib/frisbii", () => ({
  listCustomers: mockListCustomers,
  listSubscriptions: mockListSubscriptions,
  listPlans: mockListPlans,
  buildPlanMap: mockBuildPlanMap,
}));

vi.mock("@/lib/clickup", () => ({
  getAllCustomerData: mockGetAllCustomerData,
}));

vi.mock("@/lib/hubspot-companies", () => ({
  getAllCompanies: mockGetAllCompanies,
  buildCompanyIndex: mockBuildCompanyIndex,
}));

vi.mock("@/lib/sync/match-hubspot", () => ({
  matchCustomerToHubSpot: mockMatchCustomerToHubSpot,
}));

// ── Import module under test (after vi.mock()) ────────────────────────────────
import { syncCustomers } from "../sync-customers";
import { buildCustomer, buildSubscription, buildPlan } from "@/test/mocks/frisbii";
import { buildHubSpotCompany } from "@/test/mocks/hubspot";

// ── Helpers ───────────────────────────────────────────────────────────────────

function wireUpsertSuccess() {
  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });
  mocks.upsert.mockResolvedValue({ error: null });
}

function makeEmptyIndex(): CompanyIndex {
  return {
    byCVR: new Map(),
    byDomain: new Map(),
    byName: new Map(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default: empty ClickUp data
  mockGetAllCustomerData.mockResolvedValue([]);
  // Default: empty plans
  mockListPlans.mockResolvedValue([]);
  mockBuildPlanMap.mockReturnValue(new Map());
  // Default: empty company index
  mockBuildCompanyIndex.mockReturnValue(makeEmptyIndex());
  // Default: no HubSpot match
  mockMatchCustomerToHubSpot.mockReturnValue(null);

  wireUpsertSuccess();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("syncCustomers()", () => {

  it("degrades gracefully when ClickUp is down (does not fail the whole sync)", async () => {
    const customers = [buildCustomer({ handle: "cust-a" })];
    mockListCustomers.mockResolvedValue(customers);
    mockListSubscriptions.mockResolvedValue([
      buildSubscription({ customer: "cust-a", state: "active" }),
    ]);
    mockGetAllCompanies.mockResolvedValue([]);
    // ClickUp throws (e.g. CLICKUP_API_TOKEN not set)
    mockGetAllCustomerData.mockRejectedValue(new Error("CLICKUP_API_TOKEN is not set"));

    const result = await syncCustomers();
    expect(result.recordsUpserted).toBe(1); // sync still completed
  });
  it("returns SyncModuleResult with matchRate=1 when all customers match HubSpot", async () => {
    const customers = [
      buildCustomer({ handle: "cust-a" }),
      buildCustomer({ handle: "cust-b" }),
      buildCustomer({ handle: "cust-c" }),
    ];
    const subs = customers.map((c) =>
      buildSubscription({ customer: c.handle, state: "active" })
    );
    const companies = [
      buildHubSpotCompany({ id: "hs-1" }),
      buildHubSpotCompany({ id: "hs-2" }),
      buildHubSpotCompany({ id: "hs-3" }),
    ];

    mockListCustomers.mockResolvedValue(customers);
    mockListSubscriptions.mockResolvedValue(subs);
    mockGetAllCompanies.mockResolvedValue(companies);
    // All customers match HubSpot
    mockMatchCustomerToHubSpot.mockReturnValue({ hubspotCompanyId: "hs-1", matchMethod: "cvr" });

    const result = await syncCustomers();

    expect(result.recordsUpserted).toBe(3);
    expect(result.metadata?.matchedHubSpot).toBe(3);
    expect(result.metadata?.unmatchedHubSpot).toBe(0);
    expect(result.metadata?.matchRate).toBe(1);
    expect(result.metadata?.hubspotFetchError).toBeNull();
  });

  it("exposes hubspotFetchError and completes successfully when HubSpot fetch fails", async () => {
    const customers = [
      buildCustomer({ handle: "cust-a" }),
      buildCustomer({ handle: "cust-b" }),
    ];
    const subs = customers.map((c) =>
      buildSubscription({ customer: c.handle, state: "active" })
    );

    mockListCustomers.mockResolvedValue(customers);
    mockListSubscriptions.mockResolvedValue(subs);
    mockGetAllCompanies.mockRejectedValue(new Error("HubSpot API 503"));
    // matchCustomerToHubSpot is still called but returns null (empty index)
    mockMatchCustomerToHubSpot.mockReturnValue(null);

    // Must NOT throw
    const result = await syncCustomers();

    expect(result.metadata?.hubspotFetchError).toBe("HubSpot API 503");
    expect(result.recordsFetched).toBe(0); // no companies fetched
    expect(result.recordsUpserted).toBeGreaterThan(0); // customers still synced
    expect(result.metadata?.matchRate).toBe(0);
    expect(result.metadata?.matchedHubSpot).toBe(0);
  });

  it("returns correct partial match counts for mixed match scenario", async () => {
    const customers = [
      buildCustomer({ handle: "cust-a" }),
      buildCustomer({ handle: "cust-b" }),
      buildCustomer({ handle: "cust-c" }),
    ];
    const subs = customers.map((c) =>
      buildSubscription({ customer: c.handle, state: "active" })
    );
    const companies = [buildHubSpotCompany({ id: "hs-1" })];

    mockListCustomers.mockResolvedValue(customers);
    mockListSubscriptions.mockResolvedValue(subs);
    mockGetAllCompanies.mockResolvedValue(companies);

    // 2 of 3 match
    mockMatchCustomerToHubSpot
      .mockReturnValueOnce({ hubspotCompanyId: "hs-1", matchMethod: "cvr" })
      .mockReturnValueOnce({ hubspotCompanyId: "hs-1", matchMethod: "name" })
      .mockReturnValueOnce(null);

    const result = await syncCustomers();

    expect(result.metadata?.matchedHubSpot).toBe(2);
    expect(result.metadata?.unmatchedHubSpot).toBe(1);
    expect(result.metadata?.matchRate).toBeCloseTo(2 / 3, 5);
  });

  it("does NOT include hubspot_company_id key in upsert payload when match returns null", async () => {
    const customers = [buildCustomer({ handle: "cust-null-match" })];
    const subs = [buildSubscription({ customer: "cust-null-match", state: "active" })];
    const companies = [buildHubSpotCompany({ id: "hs-1" })];

    mockListCustomers.mockResolvedValue(customers);
    mockListSubscriptions.mockResolvedValue(subs);
    mockGetAllCompanies.mockResolvedValue(companies);
    mockMatchCustomerToHubSpot.mockReturnValue(null);

    await syncCustomers();

    // Verify upsert was called
    expect(mocks.upsert).toHaveBeenCalled();

    // Extract the batch passed to upsert
    const upsertCall = mocks.upsert.mock.calls[0];
    const batch: Record<string, unknown>[] = upsertCall[0];

    expect(batch).toHaveLength(1);
    // The null-strip guard must remove hubspot_company_id from the payload
    expect(Object.keys(batch[0])).not.toContain("hubspot_company_id");
  });
});
