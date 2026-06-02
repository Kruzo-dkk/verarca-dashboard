import { describe, it, expect } from "vitest";
import {
  buildCanonicalIdMap,
  collapseCustomerSummaries,
  buildLinkedGroup,
  isValidLinkDecision,
  enrichSuggestions,
  type CustomerRowForCollapse,
  type SuggestionRow,
} from "@/lib/customer-links";
import type { LinkedMember } from "@/lib/types/report";

function row(p: Partial<CustomerRowForCollapse> & { id: number; canonicalId: number }): CustomerRowForCollapse {
  return {
    name: `c${p.id}`,
    mrr: 0,
    plan: null,
    scope: null,
    tier: null,
    status: "active",
    partner: null,
    segment: null,
    matchConfidence: "high",
    frisbiiHandle: `cust-${p.id}`,
    startDate: null,
    ...p,
  };
}

describe("buildCanonicalIdMap", () => {
  it("maps secondaries to the canonical id and self-maps unlinked customers", () => {
    const customers = [
      { id: 16, frisbii_handle: "cust-0016" },
      { id: 79, frisbii_handle: "cust-0079" },
      { id: 99, frisbii_handle: "cust-0099" },
    ];
    const links = new Map([["cust-0079", "cust-0016"]]);
    const map = buildCanonicalIdMap(customers, links);
    expect(map.get(79)).toBe(16);
    expect(map.get(16)).toBe(16);
    expect(map.get(99)).toBe(99);
  });
});

describe("collapseCustomerSummaries", () => {
  it("solo customer -> linkedCount 1, no members", () => {
    const out = collapseCustomerSummaries([row({ id: 1, canonicalId: 1, mrr: 500 })]);
    expect(out).toHaveLength(1);
    expect(out[0].linkedCount).toBe(1);
    expect(out[0].linkedMembers).toBeUndefined();
    expect(out[0].mrr).toBe(500);
  });

  it("two-active group -> one row, summed MRR, linkedCount 2, per-member contributions", () => {
    const out = collapseCustomerSummaries([
      row({ id: 16, canonicalId: 16, mrr: 1199, status: "active", name: "Consensus" }),
      row({ id: 79, canonicalId: 16, mrr: 2199, status: "active", name: "Consensus" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].mrr).toBe(3398);
    expect(out[0].linkedCount).toBe(2);
    expect(out[0].linkedMembers?.map((m) => m.mrr).sort()).toEqual([1199, 2199]);
  });

  it("active canonical + churned sibling -> group status active, MRR summed", () => {
    const out = collapseCustomerSummaries([
      row({ id: 46, canonicalId: 46, mrr: 6041, status: "active" }),
      row({ id: 74, canonicalId: 46, mrr: 0, status: "churned" }),
    ]);
    expect(out[0].status).toBe("active");
    expect(out[0].mrr).toBe(6041);
    expect(out[0].linkedCount).toBe(2);
  });
});

describe("buildLinkedGroup", () => {
  const members: LinkedMember[] = [
    { id: 16, name: "Consensus", frisbiiHandle: "cust-0016", status: "active", mrr: 1199, plan: "P", startDate: "2025-07-28" },
    { id: 79, name: "Consensus", frisbiiHandle: "cust-0079", status: "active", mrr: 2199, plan: "P", startDate: "2025-09-26" },
  ];

  it("returns null for a solo customer", () => {
    expect(buildLinkedGroup([members[0]], "cust-0016", "cust-0016")).toBeNull();
  });

  it("computes activeSubscriptionCount and totalMrr", () => {
    const g = buildLinkedGroup(members, "cust-0016", "cust-0016")!;
    expect(g.activeSubscriptionCount).toBe(2);
    expect(g.totalMrr).toBe(3398);
    expect(g.isCanonical).toBe(true);
  });

  it("isCanonical is false when a secondary handle is requested", () => {
    const g = buildLinkedGroup(members, "cust-0016", "cust-0079")!;
    expect(g.isCanonical).toBe(false);
  });
});

describe("isValidLinkDecision", () => {
  it("accepts confirmed and rejected only", () => {
    expect(isValidLinkDecision("confirmed")).toBe(true);
    expect(isValidLinkDecision("rejected")).toBe(true);
    expect(isValidLinkDecision("suggested")).toBe(false);
    expect(isValidLinkDecision(undefined)).toBe(false);
    expect(isValidLinkDecision(123)).toBe(false);
  });
});

describe("enrichSuggestions", () => {
  const rows: SuggestionRow[] = [
    { id: 1, canonical_handle: "a", linked_handle: "b", cvr: null, match_method: "email", confidence: "medium" },
  ];

  it("attaches member names and status; falls back to handle when unknown", () => {
    const byHandle = new Map([["a", { name: "Acme", status: "active" }]]);
    const [s] = enrichSuggestions(rows, byHandle);
    expect(s.canonical).toEqual({ handle: "a", name: "Acme", status: "active" });
    expect(s.linked).toEqual({ handle: "b", name: "b", status: "unknown" });
    expect(s.matchMethod).toBe("email");
  });
});
