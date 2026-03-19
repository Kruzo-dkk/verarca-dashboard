import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAllCompanies, buildCompanyIndex } from "@/lib/hubspot-companies";
import { matchCustomerToHubSpot } from "@/lib/sync/match-hubspot";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const supabase = createAdminClient();

  // Fetch unmatched customers
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id, name, cvr, email, hubspot_company_id")
    .is("hubspot_company_id", null);

  if (custError) {
    return NextResponse.json({ error: custError.message }, { status: 500 });
  }

  // Fetch all HubSpot companies and build index
  const companies = await getAllCompanies();
  const index = buildCompanyIndex(companies);

  console.log(
    `[backfill-hubspot] ${customers.length} unmatched customers, ${companies.length} HubSpot companies`
  );

  const summary = {
    matched: 0,
    unmatched: 0,
    byMethod: { cvr: 0, domain: 0, name: 0 },
  };

  // Match each customer
  for (const cust of customers) {
    const result = matchCustomerToHubSpot(
      { cvr: cust.cvr, email: cust.email, name: cust.name },
      index
    );

    if (result) {
      const { error } = await supabase
        .from("customers")
        .update({ hubspot_company_id: result.hubspotCompanyId })
        .eq("id", cust.id);

      if (error) {
        console.error(
          `[backfill-hubspot] Failed to update customer ${cust.id}:`,
          error
        );
        continue;
      }

      summary.matched++;
      summary.byMethod[result.matchMethod]++;
      console.log(
        `[backfill-hubspot] Matched ${cust.name} via ${result.matchMethod} → ${result.hubspotCompanyId}`
      );
    } else {
      summary.unmatched++;
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    hubspotCompanies: companies.length,
    ...summary,
  });
}
