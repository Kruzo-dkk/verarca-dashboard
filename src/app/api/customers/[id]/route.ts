import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlanName, inferScopeFromPlan, inferTierFromPlan } from "@/lib/format-plan-name";
import { buildLinkedGroup } from "@/lib/customer-links";
import { writeAudit, diffToAuditEntries } from "@/lib/audit";
import type { LinkedMember } from "@/lib/types/report";

const VALID_SCOPES = ["Scope 1-2", "Scope 1-2-3"];
const VALID_TIERS = ["Standard", "Managed"];
const VALID_SEGMENTS = ["A", "B (Mikro)", "B", "C (Mellem)", "C (Stor)", "D"];

/**
 * GET /api/customers/[id]
 *
 * Returns detailed customer data including:
 * - Master data from `customers` table
 * - MRR history from `customer_snapshots` (trailing 24 months)
 * - External links (Frisbii, HubSpot, ClickUp)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    // Fetch customer + MRR history in parallel
    const [customerRes, snapshotsRes] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single(),
      supabase
        .from("customer_snapshots")
        .select("month, mrr, status, plan_handle, plan_name")
        .eq("customer_id", customerId)
        .order("month", { ascending: true }),
    ]);

    if (customerRes.error || !customerRes.data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const customer = customerRes.data;
    const snapshots = snapshotsRes.data ?? [];

    // ── Linked group: resolve canonical, list confirmed members + their
    //    individual MRR contribution ──
    const { data: asLinked } = await supabase
      .from("customer_links")
      .select("canonical_handle")
      .eq("linked_handle", customer.frisbii_handle)
      .eq("status", "confirmed")
      .maybeSingle();
    const canonicalHandle = asLinked?.canonical_handle ?? customer.frisbii_handle;
    const { data: groupLinks } = await supabase
      .from("customer_links")
      .select("linked_handle")
      .eq("canonical_handle", canonicalHandle)
      .eq("status", "confirmed");
    const memberHandles = [
      canonicalHandle,
      ...(groupLinks ?? []).map((g) => g.linked_handle),
    ];

    let linkedGroup = null;
    if (memberHandles.length > 1) {
      const { data: memberRows } = await supabase
        .from("customers")
        .select("id, name, frisbii_handle, status, plan_name, plan_handle, start_date")
        .in("frisbii_handle", memberHandles);
      const memberIds = (memberRows ?? []).map((m) => m.id);
      const { data: memberSnaps } = await supabase
        .from("customer_snapshots")
        .select("customer_id, mrr, month")
        .in("customer_id", memberIds)
        .order("month", { ascending: false });
      const latestMrr = new Map<number, number>();
      for (const s of memberSnaps ?? []) {
        if (!latestMrr.has(s.customer_id)) latestMrr.set(s.customer_id, s.mrr);
      }
      const members: LinkedMember[] = (memberRows ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        frisbiiHandle: m.frisbii_handle,
        status: m.status,
        mrr: latestMrr.get(m.id) ?? 0,
        plan: formatPlanName(m.plan_name ?? m.plan_handle),
        startDate: m.start_date,
      }));
      linkedGroup = buildLinkedGroup(members, canonicalHandle, customer.frisbii_handle);
    }

    // Build external links
    const links: { label: string; url: string }[] = [];

    if (customer.frisbii_handle) {
      // Find active subscription handle from Frisbii (handle is the customer handle)
      links.push({
        label: "Frisbii",
        url: `https://app.reepay.com/#/customers/${customer.frisbii_handle}`,
      });
    }

    if (customer.hubspot_company_id) {
      const hubId = process.env.HUBSPOT_PORTAL_ID ?? "";
      links.push({
        label: "HubSpot",
        url: hubId
          ? `https://app.hubspot.com/contacts/${hubId}/company/${customer.hubspot_company_id}`
          : `https://app.hubspot.com/contacts/company/${customer.hubspot_company_id}`,
      });
    }

    if (customer.clickup_folder_id) {
      links.push({
        label: "ClickUp",
        url: `https://app.clickup.com/${customer.clickup_folder_id}`,
      });
    }

    // MRR history for sparkline
    const mrrHistory = snapshots.map((s) => ({
      month: s.month,
      mrr: s.mrr,
      status: s.status,
      plan: formatPlanName(s.plan_name ?? s.plan_handle),
    }));

    const planHandle = customer.plan_handle;
    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      companyName: customer.company_name,
      frisbiiHandle: customer.frisbii_handle,
      email: customer.email,
      cvr: customer.cvr,
      segment: customer.segment,
      plan: formatPlanName(customer.plan_name ?? planHandle),
      scope: customer.scope_override ?? inferScopeFromPlan(planHandle),
      tier: customer.tier_override ?? inferTierFromPlan(planHandle),
      partner: customer.partner,
      status: customer.status,
      startDate: customer.start_date,
      churnDate: customer.churn_date,
      matchConfidence: customer.match_confidence,
      links,
      mrrHistory,
      linkedGroup,
    });
  } catch (error) {
    console.error("Failed to fetch customer detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer detail" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]
 *
 * Update manual overrides for scope, tier, and/or segment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: "Invalid customer ID" }, { status: 400 });
    }

    const body = await request.json();
    const updateData: Record<string, string | null> = {};

    if ("scope" in body) {
      if (body.scope !== null && !VALID_SCOPES.includes(body.scope)) {
        return NextResponse.json({ error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(", ")}` }, { status: 400 });
      }
      updateData.scope_override = body.scope;
    }

    if ("tier" in body) {
      if (body.tier !== null && !VALID_TIERS.includes(body.tier)) {
        return NextResponse.json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}` }, { status: 400 });
      }
      updateData.tier_override = body.tier;
    }

    if ("segment" in body) {
      if (body.segment !== null && !VALID_SEGMENTS.includes(body.segment)) {
        return NextResponse.json({ error: `Invalid segment. Must be one of: ${VALID_SEGMENTS.join(", ")}` }, { status: 400 });
      }
      updateData.segment = body.segment;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    // Snapshot current values for the audit trail before updating.
    const { data: before } = await admin
      .from("customers")
      .select("scope_override, tier_override, segment")
      .eq("id", customerId)
      .single();

    const { error } = await admin
      .from("customers")
      .update(updateData)
      .eq("id", customerId);

    if (error) {
      console.error("Failed to update customer:", error);
      return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
    }

    await writeAudit(
      diffToAuditEntries("customer", String(customerId), user.email ?? "unknown", before ?? {}, updateData)
    );

    return NextResponse.json({ ok: true, updated: updateData });
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}
