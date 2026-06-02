import { createAdminClient } from "@/lib/supabase/admin";

export type LinkStatus = "suggested" | "confirmed" | "rejected";
export type LinkMatchMethod = "cvr" | "email" | "name" | "manual";

export interface CustomerLinkRow {
  canonicalHandle: string;
  linkedHandle: string;
  cvr: string | null;
  matchMethod: LinkMatchMethod;
  confidence: string;
  status: LinkStatus;
  createdBy: string;
}

/**
 * Confirmed links only, as a Map of linkedHandle -> canonicalHandle.
 * Used to collapse churn/count/MRR so a real-world customer with multiple
 * frisbii handles is counted once. Never throws — returns an empty Map on error.
 */
export async function getConfirmedLinks(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_links")
    .select("canonical_handle, linked_handle")
    .eq("status", "confirmed");

  if (error) {
    console.warn("[get-customer-links] Failed to fetch confirmed links:", error.message);
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.linked_handle && row.canonical_handle) {
      map.set(row.linked_handle, row.canonical_handle);
    }
  }
  return map;
}

/**
 * All links with the given status, for the manual-review surface.
 * Never throws — returns [] on error.
 */
export async function getLinksByStatus(status: LinkStatus): Promise<CustomerLinkRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customer_links")
    .select("canonical_handle, linked_handle, cvr, match_method, confidence, status, created_by")
    .eq("status", status);

  if (error) {
    console.warn("[get-customer-links] Failed to fetch links by status:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    canonicalHandle: r.canonical_handle,
    linkedHandle: r.linked_handle,
    cvr: r.cvr,
    matchMethod: r.match_method as LinkMatchMethod,
    confidence: r.confidence,
    status: r.status as LinkStatus,
    createdBy: r.created_by,
  }));
}
