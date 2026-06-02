/**
 * Tests for the customer_links reader: confirmed-link Map for metrics and
 * status-filtered rows for the review surface. Graceful empty fallback on error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { client, mocks } = vi.hoisted(() => {
  const from = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const mocks = { from, select, eq };
  const client = { from };
  return { client, mocks };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));

import { getConfirmedLinks, getLinksByStatus } from "@/lib/sync/get-customer-links";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
});

describe("getConfirmedLinks", () => {
  it("returns an empty Map when the query errors (no throw)", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: "boom" } });
    const map = await getConfirmedLinks();
    expect(map.size).toBe(0);
  });

  it("builds linkedHandle -> canonicalHandle from confirmed rows only", async () => {
    mocks.eq.mockResolvedValue({
      data: [
        { canonical_handle: "cust-0016", linked_handle: "cust-0079" },
        { canonical_handle: "cust-0045", linked_handle: "cust-0087" },
      ],
      error: null,
    });
    const map = await getConfirmedLinks();
    expect(mocks.from).toHaveBeenCalledWith("customer_links");
    expect(mocks.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(map.get("cust-0079")).toBe("cust-0016");
    expect(map.get("cust-0087")).toBe("cust-0045");
    expect(map.size).toBe(2);
  });
});

describe("getLinksByStatus", () => {
  it("filters by the given status and maps to camelCase rows", async () => {
    mocks.eq.mockResolvedValue({
      data: [
        {
          canonical_handle: "cust-0016",
          linked_handle: "cust-0079",
          cvr: "29194475",
          match_method: "email",
          confidence: "medium",
          status: "suggested",
          created_by: "system",
        },
      ],
      error: null,
    });
    const rows = await getLinksByStatus("suggested");
    expect(mocks.eq).toHaveBeenCalledWith("status", "suggested");
    expect(rows).toEqual([
      {
        canonicalHandle: "cust-0016",
        linkedHandle: "cust-0079",
        cvr: "29194475",
        matchMethod: "email",
        confidence: "medium",
        status: "suggested",
        createdBy: "system",
      },
    ]);
  });

  it("returns [] on error", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await getLinksByStatus("suggested")).toEqual([]);
  });
});
