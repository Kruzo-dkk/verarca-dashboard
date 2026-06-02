import {
  listCustomers,
  listSubscriptions,
  listPlans,
  buildPlanMap,
  type Customer,
  type Subscription,
} from "@/lib/frisbii";
import { getAllCustomerData, type CustomerFolderData } from "@/lib/clickup";
import { getAllCompanies, buildCompanyIndex } from "@/lib/hubspot-companies";
import { matchCustomerToHubSpot } from "@/lib/sync/match-hubspot";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncModuleResult } from "@/lib/sync/types";
import { normalizeName } from "@/lib/sync/normalize";

// ─── Segment inference ─────────────────────────────────────────

import { inferSegmentFromPlan } from "@/lib/format-plan-name";

function inferSegment(planHandle: string | null): string {
  return inferSegmentFromPlan(planHandle);
}

// ─── Main sync ─────────────────────────────────────────────────

interface CustomerRow {
  frisbii_handle: string;
  name: string;
  email: string | null;
  cvr: string | null;
  segment: string | null;
  plan_handle: string | null;
  plan_name: string | null;
  partner: string | null;
  status: string;
  start_date: string | null;
  churn_date: string | null;
  clickup_folder_id: string | null;
  hubspot_company_id: string | null;
  company_name: string | null;
  match_confidence: string;
}

/**
 * Sync customer profiles by merging Frisbii customers with ClickUp folder data.
 *
 * Two-pass matching:
 *   1. Exact CVR match (high confidence)
 *   2. Normalised company name match (medium confidence)
 *   3. Unmatched Frisbii customers kept with low confidence
 */
export async function syncCustomers(): Promise<SyncModuleResult> {
  console.log("[sync-customers] Starting customer sync");

  // ── Fetch sources in parallel ──────────────────────────────
  const [frisbiiCustomers, subscriptions, clickupFolders, plans] = await Promise.all([
    listCustomers(),
    listSubscriptions({ state: ["active", "expired", "cancelled", "on_hold"] }),
    getAllCustomerData(),
    listPlans(),
  ]);

  let hubspotCompanies: Awaited<ReturnType<typeof getAllCompanies>> = [];
  let hubspotFetchError: string | null = null;
  try {
    hubspotCompanies = await getAllCompanies();
  } catch (err) {
    hubspotFetchError = err instanceof Error ? err.message : String(err);
    console.error("[sync-customers] HubSpot company fetch failed:", hubspotFetchError);
  }

  const planMap = buildPlanMap(plans);
  const hubspotIndex = buildCompanyIndex(hubspotCompanies);

  console.log(
    `[sync-customers] Sources: ${frisbiiCustomers.length} Frisbii customers, ` +
      `${subscriptions.length} subscriptions, ${clickupFolders.length} ClickUp folders, ` +
      `${hubspotCompanies.length} HubSpot companies`
  );

  // ── Build lookup maps ──────────────────────────────────────

  // Map customer handle -> their active subscription (pick first active)
  // Build subscription map: prefer active, fall back to most recent expired/cancelled
  const subByCustomer = new Map<string, Subscription>();
  // Sort so active comes first, then by created descending (most recent first)
  const sortedSubs = [...subscriptions].sort((a, b) => {
    if (a.state === "active" && b.state !== "active") return -1;
    if (b.state === "active" && a.state !== "active") return 1;
    return b.created.localeCompare(a.created);
  });
  for (const sub of sortedSubs) {
    if (!subByCustomer.has(sub.customer)) {
      subByCustomer.set(sub.customer, sub);
    }
  }

  // ClickUp lookup by CVR (normalised)
  const clickupByCVR = new Map<string, CustomerFolderData>();
  // ClickUp lookup by normalised name
  const clickupByName = new Map<string, CustomerFolderData>();

  for (const folder of clickupFolders) {
    if (folder.cvr) {
      const normalizedCVR = folder.cvr.replace(/\D/g, "");
      if (normalizedCVR) {
        clickupByCVR.set(normalizedCVR, folder);
      }
    }
    const normalized = normalizeName(folder.name);
    if (normalized) {
      clickupByName.set(normalized, folder);
    }
  }

  // ── Match and build rows ───────────────────────────────────
  const rows: CustomerRow[] = [];
  let matchedHubSpot = 0;
  let clickupHigh = 0;
  let clickupMedium = 0;
  let clickupLow = 0;

  for (const customer of frisbiiCustomers) {
    const sub = subByCustomer.get(customer.handle);

    // Attempt to extract VAT/CVR from the Frisbii customer object.
    // The TypeScript type doesn't include `vat` but the API returns it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vat = (customer as any).vat ? String((customer as any).vat).replace(/\D/g, "") : null;

    let clickupMatch: CustomerFolderData | null = null;
    let confidence: "high" | "medium" | "low" = "low";

    // Pass 1: Exact CVR match
    if (vat && clickupByCVR.has(vat)) {
      clickupMatch = clickupByCVR.get(vat)!;
      confidence = "high";
    }

    // Pass 2: Normalised name match (fallback)
    if (!clickupMatch) {
      const displayName =
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        customer.handle;
      const normalizedCustomerName = normalizeName(displayName);
      if (normalizedCustomerName && clickupByName.has(normalizedCustomerName)) {
        clickupMatch = clickupByName.get(normalizedCustomerName)!;
        confidence = "medium";
      }
    }

    // Determine status
    let status = "active";
    if (sub) {
      status = sub.state === "active" ? "active" : sub.state;
    } else if (customer.active_subscriptions === 0) {
      status = "churned";
    }

    // Determine start date: subscription activated > sub created > ClickUp > Frisbii customer created
    let startDate: string | null = null;
    if (sub?.activated) {
      startDate = sub.activated.substring(0, 10);
    } else if (sub?.created) {
      startDate = sub.created.substring(0, 10);
    } else if (clickupMatch?.startDate) {
      // ClickUp stores dates as Unix ms timestamps
      const ts = parseInt(clickupMatch.startDate, 10);
      if (!isNaN(ts) && ts > 0) {
        startDate = new Date(ts).toISOString().substring(0, 10);
      } else {
        startDate = clickupMatch.startDate.substring(0, 10);
      }
    } else if (customer.created) {
      startDate = customer.created.substring(0, 10);
    }

    // Churn date from subscription
    const churnDate = sub?.expired_date
      ? sub.expired_date.substring(0, 10)
      : sub?.cancelled_date
        ? sub.cancelled_date.substring(0, 10)
        : null;

    // Prefer ClickUp folder name, then Frisbii contact name, then handle
    const frisbiiName = [customer.first_name, customer.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const companyName = clickupMatch?.name || frisbiiName || customer.handle;

    const hubspotMatch = matchCustomerToHubSpot(
      { cvr: vat || (clickupMatch?.cvr ? clickupMatch.cvr.replace(/\D/g, "") : null), email: customer.email || null, name: companyName },
      hubspotIndex
    );
    if (hubspotMatch !== null) matchedHubSpot++;

    if (confidence === "high") clickupHigh++;
    else if (confidence === "medium") clickupMedium++;
    else clickupLow++;

    rows.push({
      frisbii_handle: customer.handle,
      name: companyName,
      email: customer.email || null,
      cvr: vat || (clickupMatch?.cvr ? clickupMatch.cvr.replace(/\D/g, "") : null),
      segment: inferSegment(sub?.plan || null),
      plan_handle: sub?.plan || null,
      plan_name: sub?.plan ? (planMap.get(sub.plan)?.name ?? sub.plan) : null,
      partner: clickupMatch?.partner || null,
      status,
      start_date: startDate,
      churn_date: churnDate,
      clickup_folder_id: clickupMatch?.folderId || null,
      hubspot_company_id: hubspotMatch?.hubspotCompanyId ?? null,
      company_name: hubspotMatch?.companyName ?? null,
      match_confidence: confidence,
    });
  }

  console.log(
    `[sync-customers] Built ${rows.length} customer rows ` +
      `(high: ${clickupHigh}, medium: ${clickupMedium}, low: ${clickupLow})`
  );

  // ── Upsert in batches ──────────────────────────────────────
  // Strip fields that should not overwrite manually-set DB values:
  // - segment: when inference returns "Unknown"
  // - hubspot_company_id: when matching returns null (preserve existing)
  const cleanedRows = rows.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cleaned: any = row;
    if (cleaned.segment === "Unknown") {
      const { segment: _, ...rest } = cleaned;
      cleaned = rest;
    }
    if (cleaned.hubspot_company_id === null) {
      const { hubspot_company_id: _, ...rest } = cleaned;
      cleaned = rest;
    }
    if (cleaned.company_name === null) {
      const { company_name: _, ...rest } = cleaned;
      cleaned = rest;
    }
    return cleaned;
  });

  const supabase = createAdminClient();
  const BATCH_SIZE = 50;

  for (let i = 0; i < cleanedRows.length; i += BATCH_SIZE) {
    const batch = cleanedRows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("customers")
      .upsert(batch as typeof rows, { onConflict: "frisbii_handle" });

    if (error) {
      console.error(
        `[sync-customers] Upsert batch ${i / BATCH_SIZE + 1} failed:`,
        error
      );
      throw new Error(`[sync-customers] Upsert failed: ${error.message}`);
    }
  }

  const total = rows.length;
  const unmatchedHubSpot = total - matchedHubSpot;
  const matchRate = total === 0 ? 0 : matchedHubSpot / total;

  console.log(`[sync-customers] Successfully synced ${rows.length} customers`);

  return {
    recordsFetched: hubspotCompanies.length,
    recordsUpserted: rows.length,
    metadata: {
      matchedHubSpot,
      unmatchedHubSpot,
      matchRate,
      clickupHigh,
      clickupMedium,
      clickupLow,
      hubspotFetchError,
    },
  };
}
