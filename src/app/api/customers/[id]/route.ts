import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      plan: s.plan_name ?? s.plan_handle,
    }));

    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      frisbiiHandle: customer.frisbii_handle,
      email: customer.email,
      cvr: customer.cvr,
      segment: customer.segment,
      plan: customer.plan_name ?? customer.plan_handle,
      partner: customer.partner,
      status: customer.status,
      startDate: customer.start_date,
      churnDate: customer.churn_date,
      matchConfidence: customer.match_confidence,
      links,
      mrrHistory,
    });
  } catch (error) {
    console.error("Failed to fetch customer detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer detail" },
      { status: 500 }
    );
  }
}
