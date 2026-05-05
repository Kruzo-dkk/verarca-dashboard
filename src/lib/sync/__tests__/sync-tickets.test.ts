/**
 * Tests for syncTickets() — verifies it returns SyncModuleResult with
 * recordsFetched, recordsUpserted, and metadata fields tracking company resolution.
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
  const not = vi.fn();

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
    not,
  };

  const client = { from };
  return { client, mocks };
});

// ── Mock Supabase admin ───────────────────────────────────────────────────
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => client,
}));

// ── Mock fetchTickets ─────────────────────────────────────────────────────
vi.mock("@/lib/hubspot-tickets", () => ({
  fetchTickets: vi.fn(),
}));

import { syncTickets } from "../sync-tickets";
import { fetchTickets } from "@/lib/hubspot-tickets";
import { buildHubSpotTicket } from "@/test/mocks/hubspot";

// ── Customer rows returned from Supabase ──────────────────────────────────
const CUSTOMER_1 = { id: 101, hubspot_company_id: "hs-company-1" };
const CUSTOMER_2 = { id: 202, hubspot_company_id: "hs-company-2" };

function wireChain(customersData: { id: number; hubspot_company_id: string }[] = []) {
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
    not: mocks.not,
  };

  mocks.from.mockReturnValue({
    select: mocks.select,
    insert: mocks.insert,
    upsert: mocks.upsert,
    update: mocks.update,
    delete: mocks.delete,
  });

  // select() on customers table returns chainable with .not()
  // select() on ticket_snapshots table returns upsert-ready (upsert is on from() result)
  mocks.select.mockReturnValue({ ...queryChain });

  // .not() resolves with the customers data
  mocks.not.mockResolvedValue({ data: customersData, error: null });

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
  wireChain([CUSTOMER_1, CUSTOMER_2]);
});

describe("syncTickets", () => {
  it("empty tickets → recordsFetched=0, recordsUpserted=0, metadata all zeros/empty", async () => {
    vi.mocked(fetchTickets).mockResolvedValue([]);

    const result = await syncTickets("2026-05");

    expect(result.recordsFetched).toBe(0);
    expect(result.recordsUpserted).toBe(0);
    expect(result.metadata).toMatchObject({
      ticketsWithCompany: 0,
      ticketsWithoutCompany: 0,
      customersResolved: 0,
      mappedCompanies: 2,
      unresolvedCompanyIds: [],
    });
    // Upsert should never be called
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("ticket with matching company → customer_id set in upsert, customersResolved increments", async () => {
    const ticket = buildHubSpotTicket({ companyId: "hs-company-1" });
    vi.mocked(fetchTickets).mockResolvedValue([ticket]);

    const result = await syncTickets("2026-05");

    expect(result.recordsFetched).toBe(1);
    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      ticketsWithCompany: 1,
      ticketsWithoutCompany: 0,
      customersResolved: 1,
      unresolvedCompanyIds: [],
    });
    // Verify the upsert was called with the correct customer_id
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 101 }),
      expect.objectContaining({ onConflict: "month,hubspot_ticket_id" }),
    );
  });

  it("ticket with company NOT in customers table → customer_id null, unresolved id tracked", async () => {
    const ticket = buildHubSpotTicket({ companyId: "hs-company-unknown" });
    vi.mocked(fetchTickets).mockResolvedValue([ticket]);

    const result = await syncTickets("2026-05");

    expect(result.recordsFetched).toBe(1);
    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      ticketsWithCompany: 1,
      ticketsWithoutCompany: 0,
      customersResolved: 0,
      unresolvedCompanyIds: ["hs-company-unknown"],
    });
    // Upsert should have null customer_id
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: null }),
      expect.objectContaining({ onConflict: "month,hubspot_ticket_id" }),
    );
  });

  it("ticket without company association → customer_id null, ticketsWithoutCompany increments", async () => {
    const ticket = buildHubSpotTicket({ companyId: null });
    vi.mocked(fetchTickets).mockResolvedValue([ticket]);

    const result = await syncTickets("2026-05");

    expect(result.recordsFetched).toBe(1);
    expect(result.recordsUpserted).toBe(1);
    expect(result.metadata).toMatchObject({
      ticketsWithCompany: 0,
      ticketsWithoutCompany: 1,
      customersResolved: 0,
      unresolvedCompanyIds: [],
    });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: null }),
      expect.objectContaining({ onConflict: "month,hubspot_ticket_id" }),
    );
  });

  it("upsert error propagates as thrown error", async () => {
    const ticket = buildHubSpotTicket({ companyId: null });
    vi.mocked(fetchTickets).mockResolvedValue([ticket]);
    mocks.upsert.mockResolvedValue({ error: { message: "DB connection failed" } });

    await expect(syncTickets("2026-05")).rejects.toThrow("DB connection failed");
  });

  it("onConflict 'month,hubspot_ticket_id' is always passed to upsert", async () => {
    const ticket = buildHubSpotTicket({ companyId: "hs-company-1" });
    vi.mocked(fetchTickets).mockResolvedValue([ticket]);

    await syncTickets("2026-05");

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: "month,hubspot_ticket_id" },
    );
  });

  it("unresolvedCompanyIds is capped at 20 entries", async () => {
    // 25 tickets each with a distinct unknown company
    const tickets = Array.from({ length: 25 }, (_, i) =>
      buildHubSpotTicket({ companyId: `unknown-company-${i}` }),
    );
    vi.mocked(fetchTickets).mockResolvedValue(tickets);

    const result = await syncTickets("2026-05");

    expect(result.metadata?.unresolvedCompanyIds).toHaveLength(20);
  });

  it("MISSING_SCOPES → returns scope-blocked success instead of throwing", async () => {
    vi.mocked(fetchTickets).mockRejectedValue(
      new Error(
        'HubSpot API error 403: {"status":"error","message":"The scope needed for this API call isn\'t available for public use.","category":"MISSING_SCOPES"}'
      )
    );

    const result = await syncTickets("2026-05");

    expect(result.recordsFetched).toBeNull();
    expect(result.recordsUpserted).toBe(0);
    expect(result.metadata?.scopeBlocked).toBe(true);
    expect(result.metadata?.scopeError).toEqual(expect.stringContaining("MISSING_SCOPES"));
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("non-scope errors still propagate (e.g. 500)", async () => {
    vi.mocked(fetchTickets).mockRejectedValue(
      new Error("HubSpot API error 500: internal server error")
    );

    await expect(syncTickets("2026-05")).rejects.toThrow("500");
  });
});
