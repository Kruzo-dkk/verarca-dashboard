import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ───────────────────────────────────────────────
// Each .select() call needs to return either a plain object (head: true)
// or a chainable object. We implement per-call control via mockReturnValueOnce.

const mockNot = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ─── HubSpot mock ────────────────────────────────────────────────
const mockHubspotFetch = vi.fn();
const mockHubspotPost = vi.fn();

vi.mock("@/lib/hubspot", () => ({
  hubspotFetch: (...args: unknown[]) => mockHubspotFetch(...args),
  hubspotPost: (...args: unknown[]) => mockHubspotPost(...args),
}));

// Import AFTER mocks are registered
import { GET } from "../diagnose-hubspot/route";

// ─── Helpers ─────────────────────────────────────────────────────

function makeRequest(withSecret = true): Request {
  const headers: Record<string, string> = {};
  if (withSecret) {
    headers["authorization"] = "Bearer test-secret";
  }
  return new Request("http://localhost/api/cron/diagnose-hubspot", { headers });
}

function setupHubspotHappyPath() {
  // /owners?limit=1
  mockHubspotFetch.mockResolvedValueOnce({ results: [{}], total: 7 });
  // /pipelines/deals
  mockHubspotFetch.mockResolvedValueOnce({
    results: [
      { label: "Default Pipeline" },
      { label: "Enterprise Pipeline" },
    ],
  });
  // POST /objects/deals/search → total
  mockHubspotPost.mockResolvedValueOnce({ total: 42 });
  // POST /objects/companies/search → total
  mockHubspotPost.mockResolvedValueOnce({ total: 99 });
}

function setupSupabaseHappyCounts(
  pipelineSnapshots = 26,
  customersTotal = 145,
  customersMatched = 50
) {
  // pipeline_snapshots count
  mockSelect.mockResolvedValueOnce({ count: pipelineSnapshots, error: null });
  // customers total count
  mockSelect.mockResolvedValueOnce({ count: customersTotal, error: null });
  // customers matched (hubspot_company_id IS NOT NULL) — chained with .not()
  mockSelect.mockReturnValueOnce({ not: mockNot });
  mockNot.mockResolvedValueOnce({ count: customersMatched, error: null });
}

// ─── Tests ───────────────────────────────────────────────────────

describe("GET /api/cron/diagnose-hubspot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    // Default: from() returns { select }
    mockFrom.mockReturnValue({ select: mockSelect });
    // Default mockNot
    mockNot.mockResolvedValue({ count: 0, error: null });
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await GET(makeRequest(false));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with correct shape on happy path", async () => {
    setupHubspotHappyPath();
    setupSupabaseHappyCounts(26, 145, 50);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();

    // apiToken
    expect(body.apiToken).toEqual({ ok: true, error: null });

    // pipelines
    expect(body.pipelines).toEqual({
      count: 2,
      labels: ["Default Pipeline", "Enterprise Pipeline"],
    });

    // deals
    expect(body.deals).toEqual({
      totalInHubSpot: 42,
      totalInSupabase: 26,
    });

    // companies
    expect(body.companies).toEqual({
      totalInHubSpot: 99,
      totalInSupabase: 145,
      matched: 50,
    });

    // owners
    expect(body.owners).toEqual({ count: 7 });

    // timestamp is an ISO string
    expect(typeof body.timestamp).toBe("string");
    expect(() => new Date(body.timestamp)).not.toThrow();
  });

  it("returns 200 with apiToken.ok=false and null HubSpot fields when token is invalid", async () => {
    // All hubspotFetch/hubspotPost calls throw
    mockHubspotFetch.mockRejectedValue(new Error("HubSpot API error 401: Unauthorized"));
    mockHubspotPost.mockRejectedValue(new Error("HubSpot API error 401: Unauthorized"));

    // Supabase still works
    setupSupabaseHappyCounts(26, 145, 50);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.apiToken.ok).toBe(false);
    expect(body.apiToken.error).toContain("401");
    expect(body.pipelines).toBeNull();
    expect(body.deals.totalInHubSpot).toBeNull();
    expect(body.companies.totalInHubSpot).toBeNull();
    // owners defaults to 0 on failure
    expect(body.owners).toEqual({ count: 0 });
  });

  it("reflects correct Supabase counts in the response", async () => {
    setupHubspotHappyPath();
    setupSupabaseHappyCounts(26, 145, 50);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.deals.totalInSupabase).toBe(26);
    expect(body.companies.totalInSupabase).toBe(145);
    expect(body.companies.matched).toBe(50);
  });
});
