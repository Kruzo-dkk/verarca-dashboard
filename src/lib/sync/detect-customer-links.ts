import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncModuleResult } from "@/lib/sync/types";
import { normalizeName, normalizeCvr, normalizeEmail } from "@/lib/sync/normalize";

export interface CustomerForLink {
  id: number;
  frisbii_handle: string;
  name: string | null;
  email: string | null;
  cvr: string | null;
  status: string;
  start_date: string | null;
}

export interface CandidateLink {
  canonical_handle: string;
  linked_handle: string;
  cvr: string | null;
  match_method: "cvr" | "email" | "name";
  confidence: "high" | "medium" | "low";
  status: "confirmed" | "suggested";
  created_by: "system";
}

export interface ExistingLink {
  linked_handle: string;
  status: string;
  created_by: string;
}

/**
 * Deterministically choose the canonical (primary) row for a duplicate group:
 *   1. prefer status === "active"
 *   2. then the earliest non-null start_date (the original signup)
 *   3. then the lowest id (stable)
 */
export function pickCanonical(rows: CustomerForLink[]): CustomerForLink {
  return [...rows].sort((a, b) => {
    const aActive = a.status === "active" ? 0 : 1;
    const bActive = b.status === "active" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    const aDate = a.start_date ?? "9999-12-31";
    const bDate = b.start_date ?? "9999-12-31";
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    return a.id - b.id;
  })[0];
}

function groupBy(
  rows: CustomerForLink[],
  keyFn: (c: CustomerForLink) => string | null
): Map<string, CustomerForLink[]> {
  const map = new Map<string, CustomerForLink[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/**
 * Pure detection: group customers by CVR (auto-confirmed), then by email and
 * name (suggested for manual review). Every member of a group points at the
 * single group canonical — chains are resolved so a secondary never points at
 * another secondary. A handle is linked at most once (CVR wins over email over
 * name).
 */
export function buildCandidateLinks(customers: CustomerForLink[]): {
  links: CandidateLink[];
  metadata: {
    cvrGroups: number;
    cvrLinks: number;
    emailSuggestions: number;
    nameSuggestions: number;
  };
} {
  const links: CandidateLink[] = [];
  const linkTarget = new Map<string, string>(); // linked_handle -> canonical_handle
  let cvrGroups = 0;
  let cvrLinks = 0;
  let emailSuggestions = 0;
  let nameSuggestions = 0;

  const resolveCanonical = (handle: string): string => {
    let h = handle;
    const seen = new Set<string>();
    while (linkTarget.has(h) && !seen.has(h)) {
      seen.add(h);
      h = linkTarget.get(h)!;
    }
    return h;
  };

  const addLinks = (
    groups: Map<string, CustomerForLink[]>,
    method: CandidateLink["match_method"],
    confidence: CandidateLink["confidence"],
    status: CandidateLink["status"],
    onLink: () => void,
    onGroup?: () => void
  ) => {
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      onGroup?.();
      const canonicalHandle = resolveCanonical(pickCanonical(group).frisbii_handle);
      for (const row of group) {
        if (row.frisbii_handle === canonicalHandle) continue;
        if (linkTarget.has(row.frisbii_handle)) continue; // already claimed
        // For suggested methods, skip pairs already merged via CVR (same CVR group).
        if (method !== "cvr") {
          const rowCvr = normalizeCvr(row.cvr);
          const canCvr = normalizeCvr(
            group.find((g) => g.frisbii_handle === canonicalHandle)?.cvr ?? null
          );
          if (rowCvr && canCvr && rowCvr === canCvr) continue;
        }
        links.push({
          canonical_handle: canonicalHandle,
          linked_handle: row.frisbii_handle,
          cvr: normalizeCvr(row.cvr),
          match_method: method,
          confidence,
          status,
          created_by: "system",
        });
        linkTarget.set(row.frisbii_handle, canonicalHandle);
        onLink();
      }
    }
  };

  addLinks(
    groupBy(customers, (c) => normalizeCvr(c.cvr)),
    "cvr",
    "high",
    "confirmed",
    () => cvrLinks++,
    () => cvrGroups++
  );
  addLinks(
    groupBy(customers, (c) => normalizeEmail(c.email)),
    "email",
    "medium",
    "suggested",
    () => emailSuggestions++
  );
  addLinks(
    groupBy(customers, (c) => normalizeName(c.name ?? "") || null),
    "name",
    "low",
    "suggested",
    () => nameSuggestions++
  );

  return { links, metadata: { cvrGroups, cvrLinks, emailSuggestions, nameSuggestions } };
}

/**
 * Filter out candidates whose linked_handle a human already confirmed or
 * rejected — the system must never clobber a manual decision.
 */
export function filterHumanDecisions(
  candidates: CandidateLink[],
  existing: ExistingLink[]
): { toUpsert: CandidateLink[]; skipped: number } {
  const humanDecided = new Set(
    existing
      .filter(
        (e) =>
          e.created_by !== "system" &&
          (e.status === "confirmed" || e.status === "rejected")
      )
      .map((e) => e.linked_handle)
  );
  const toUpsert = candidates.filter((c) => !humanDecided.has(c.linked_handle));
  return { toUpsert, skipped: candidates.length - toUpsert.length };
}

/**
 * Detect duplicate customers and persist links. CVR matches are auto-confirmed;
 * email/name matches are stored as suggestions for manual review. Existing
 * human decisions are preserved. Never throws — degrades to a no-op result.
 */
export async function detectCustomerLinks(): Promise<SyncModuleResult> {
  const supabase = createAdminClient();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, frisbii_handle, name, email, cvr, status, start_date");

  if (error) {
    console.warn("[detect-customer-links] Failed to fetch customers:", error.message);
    return { recordsFetched: null, recordsUpserted: 0, metadata: { error: error.message } };
  }

  const rows = (customers ?? []) as CustomerForLink[];
  const { links, metadata } = buildCandidateLinks(rows);

  if (links.length === 0) {
    return { recordsFetched: rows.length, recordsUpserted: 0, metadata };
  }

  // Preserve human decisions: read existing rows for these handles.
  const { data: existing } = await supabase
    .from("customer_links")
    .select("linked_handle, status, created_by")
    .in(
      "linked_handle",
      links.map((l) => l.linked_handle)
    );

  const { toUpsert, skipped } = filterHumanDecisions(links, (existing ?? []) as ExistingLink[]);

  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from("customer_links")
      .upsert(toUpsert, { onConflict: "linked_handle" });
    if (upsertError) {
      console.warn("[detect-customer-links] Upsert failed:", upsertError.message);
      return {
        recordsFetched: rows.length,
        recordsUpserted: 0,
        metadata: { ...metadata, error: upsertError.message },
      };
    }
  }

  return {
    recordsFetched: rows.length,
    recordsUpserted: toUpsert.length,
    metadata: { ...metadata, skippedHumanDecisions: skipped },
  };
}
