/**
 * Tests for customer-link detection: canonical selection, CVR auto-confirm,
 * email/name suggestions, chain avoidance, and preservation of human decisions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { client, fromImpl } = vi.hoisted(() => {
  const fromImpl = { current: (_table: string) => ({} as any) };
  const client = { from: (table: string) => fromImpl.current(table) };
  return { client, fromImpl };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client }));

import {
  pickCanonical,
  buildCandidateLinks,
  filterHumanDecisions,
  detectCustomerLinks,
  type CustomerForLink,
} from "@/lib/sync/detect-customer-links";

function cust(p: Partial<CustomerForLink> & { id: number; frisbii_handle: string }): CustomerForLink {
  return {
    name: null,
    email: null,
    cvr: null,
    status: "active",
    start_date: null,
    ...p,
  };
}

describe("pickCanonical", () => {
  it("prefers active over churned", () => {
    const rows = [
      cust({ id: 2, frisbii_handle: "b", status: "churned", start_date: "2025-01-01" }),
      cust({ id: 1, frisbii_handle: "a", status: "active", start_date: "2025-06-01" }),
    ];
    expect(pickCanonical(rows).frisbii_handle).toBe("a");
  });

  it("among actives, earliest start_date wins", () => {
    const rows = [
      cust({ id: 9, frisbii_handle: "late", status: "active", start_date: "2025-09-01" }),
      cust({ id: 3, frisbii_handle: "early", status: "active", start_date: "2025-07-01" }),
    ];
    expect(pickCanonical(rows).frisbii_handle).toBe("early");
  });

  it("null start_date is deprioritised, id breaks ties", () => {
    const rows = [
      cust({ id: 5, frisbii_handle: "nodate", status: "active", start_date: null }),
      cust({ id: 7, frisbii_handle: "d1", status: "active", start_date: "2025-05-01" }),
      cust({ id: 4, frisbii_handle: "d2", status: "active", start_date: "2025-05-01" }),
    ];
    expect(pickCanonical(rows).frisbii_handle).toBe("d2"); // same date, lower id
  });
});

describe("buildCandidateLinks", () => {
  it("CVR group of 1 active + 2 churned -> 2 confirmed cvr links at the active canonical", () => {
    const rows = [
      cust({ id: 1, frisbii_handle: "active", cvr: "39257904", status: "active", start_date: "2026-04-20" }),
      cust({ id: 2, frisbii_handle: "ch1", cvr: "39257904", status: "churned", start_date: "2026-04-20" }),
      cust({ id: 3, frisbii_handle: "ch2", cvr: "39257904", status: "churned", start_date: "2026-04-20" }),
    ];
    const { links, metadata } = buildCandidateLinks(rows);
    expect(metadata.cvrGroups).toBe(1);
    expect(metadata.cvrLinks).toBe(2);
    expect(links.every((l) => l.canonical_handle === "active")).toBe(true);
    expect(links.every((l) => l.status === "confirmed" && l.match_method === "cvr")).toBe(true);
    expect(links.map((l) => l.linked_handle).sort()).toEqual(["ch1", "ch2"]);
  });

  it("two active rows same CVR -> 1 confirmed link, canonical = earliest start_date", () => {
    const rows = [
      cust({ id: 16, frisbii_handle: "cust-0016", cvr: "29194475", status: "active", start_date: "2025-07-28" }),
      cust({ id: 79, frisbii_handle: "cust-0079", cvr: "29194475", status: "active", start_date: "2025-09-26" }),
    ];
    const { links } = buildCandidateLinks(rows);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      canonical_handle: "cust-0016",
      linked_handle: "cust-0079",
      status: "confirmed",
    });
  });

  it("single-row CVR group emits no link", () => {
    const rows = [cust({ id: 1, frisbii_handle: "solo", cvr: "111" })];
    expect(buildCandidateLinks(rows).links).toHaveLength(0);
  });

  it("email-only group (distinct CVRs) -> suggested email links, not confirmed", () => {
    const rows = [
      cust({ id: 1, frisbii_handle: "a", email: "sanne@m-k.dk", cvr: "40840885", start_date: "2025-01-01" }),
      cust({ id: 2, frisbii_handle: "b", email: "sanne@m-k.dk", cvr: "40840915", start_date: "2025-02-01" }),
      cust({ id: 3, frisbii_handle: "c", email: "sanne@m-k.dk", cvr: "44153319", start_date: "2025-03-01" }),
    ];
    const { links, metadata } = buildCandidateLinks(rows);
    expect(metadata.cvrLinks).toBe(0);
    expect(metadata.emailSuggestions).toBe(2);
    expect(links.every((l) => l.status === "suggested" && l.match_method === "email")).toBe(true);
    expect(links.every((l) => l.canonical_handle === "a")).toBe(true);
  });

  it("does not double-link: a CVR secondary is not also suggested via email", () => {
    const rows = [
      cust({ id: 1, frisbii_handle: "canon", cvr: "100", email: "x@y.dk", status: "active", start_date: "2025-01-01" }),
      cust({ id: 2, frisbii_handle: "dupe", cvr: "100", email: "x@y.dk", status: "churned", start_date: "2025-01-01" }),
    ];
    const { links } = buildCandidateLinks(rows);
    expect(links).toHaveLength(1);
    expect(links[0].match_method).toBe("cvr");
  });

  it("name-only group -> suggested name link", () => {
    const rows = [
      cust({ id: 1, frisbii_handle: "a", name: "Acme ApS", start_date: "2025-01-01" }),
      cust({ id: 2, frisbii_handle: "b", name: "Acme", start_date: "2025-02-01" }),
    ];
    const { links, metadata } = buildCandidateLinks(rows);
    expect(metadata.nameSuggestions).toBe(1);
    expect(links[0]).toMatchObject({ match_method: "name", confidence: "low", status: "suggested" });
  });
});

describe("filterHumanDecisions", () => {
  const candidate = {
    canonical_handle: "a",
    linked_handle: "b",
    cvr: "1",
    match_method: "cvr" as const,
    confidence: "high" as const,
    status: "confirmed" as const,
    created_by: "system" as const,
  };

  it("excludes a linked_handle a human rejected", () => {
    const { toUpsert, skipped } = filterHumanDecisions(
      [candidate],
      [{ linked_handle: "b", status: "rejected", created_by: "thomas@andersens.nu" }]
    );
    expect(toUpsert).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("keeps a candidate whose existing row is a system confirm (idempotent)", () => {
    const { toUpsert } = filterHumanDecisions(
      [candidate],
      [{ linked_handle: "b", status: "confirmed", created_by: "system" }]
    );
    expect(toUpsert).toHaveLength(1);
  });
});

describe("detectCustomerLinks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts confirmed cvr links with onConflict linked_handle", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    fromImpl.current = (table: string) => {
      if (table === "customers") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { id: 1, frisbii_handle: "a", name: "X", email: null, cvr: "100", status: "active", start_date: "2025-01-01" },
                { id: 2, frisbii_handle: "b", name: "X", email: null, cvr: "100", status: "churned", start_date: "2025-01-01" },
              ],
              error: null,
            }),
        };
      }
      // customer_links
      return {
        select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }),
        upsert,
      };
    };

    const result = await detectCustomerLinks();
    expect(result.recordsFetched).toBe(2);
    expect(result.recordsUpserted).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload, opts] = upsert.mock.calls[0];
    expect(opts).toEqual({ onConflict: "linked_handle" });
    expect(payload[0]).toMatchObject({ canonical_handle: "a", linked_handle: "b", status: "confirmed" });
  });

  it("returns a no-op result on fetch error", async () => {
    fromImpl.current = () => ({
      select: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    });
    const result = await detectCustomerLinks();
    expect(result.recordsUpserted).toBe(0);
    expect(result.recordsFetched).toBeNull();
  });
});
