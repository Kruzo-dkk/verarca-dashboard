import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubspotFetch, hubspotPost } from "@/lib/hubspot";

interface DiagnoseResponse {
  apiToken: { ok: boolean; error: string | null };
  pipelines: { count: number; labels: string[] } | null;
  deals: { totalInHubSpot: number | null; totalInSupabase: number };
  companies: { totalInHubSpot: number | null; totalInSupabase: number; matched: number };
  owners: { count: number };
  timestamp: string;
}

export async function GET(request: Request): Promise<NextResponse<DiagnoseResponse | { error: string }>> {
  // Auth — same pattern as backfill-hubspot
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // ── 1. Probe HubSpot API token via /owners ────────────────────
  let apiTokenOk = false;
  let apiTokenError: string | null = null;
  let ownersTotal = 0;

  try {
    const ownersRes = await hubspotFetch<{ results: unknown[]; total: number }>(
      "/owners?limit=1"
    );
    apiTokenOk = true;
    ownersTotal = ownersRes.total ?? 0;
  } catch (err) {
    apiTokenError = err instanceof Error ? err.message : String(err);
  }

  // ── 2. Pipelines (best-effort) ────────────────────────────────
  let pipelines: DiagnoseResponse["pipelines"] = null;
  if (apiTokenOk) {
    try {
      const pipelinesRes = await hubspotFetch<{ results: { label: string }[] }>(
        "/pipelines/deals"
      );
      pipelines = {
        count: pipelinesRes.results.length,
        labels: pipelinesRes.results.map((p) => p.label),
      };
    } catch {
      pipelines = null;
    }
  }

  // ── 3. Deals total in HubSpot (best-effort) ───────────────────
  let dealsInHubSpot: number | null = null;
  if (apiTokenOk) {
    try {
      const searchRes = await hubspotPost<{ total: number }>(
        "/objects/deals/search",
        { limit: 1 }
      );
      dealsInHubSpot = searchRes.total;
    } catch {
      dealsInHubSpot = null;
    }
  }

  // ── 4. Companies total in HubSpot (best-effort) ───────────────
  let companiesInHubSpot: number | null = null;
  if (apiTokenOk) {
    try {
      const searchRes = await hubspotPost<{ total: number }>(
        "/objects/companies/search",
        { limit: 1 }
      );
      companiesInHubSpot = searchRes.total;
    } catch {
      companiesInHubSpot = null;
    }
  }

  // ── 5. Supabase counts ────────────────────────────────────────
  const { count: dealsInSupabase } = await supabase
    .from("pipeline_snapshots")
    .select("*", { count: "exact", head: true });

  const { count: companiesInSupabase } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });

  const { count: companiesMatched } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .not("hubspot_company_id", "is", null);

  // ── 6. Compose response ───────────────────────────────────────
  const response: DiagnoseResponse = {
    apiToken: { ok: apiTokenOk, error: apiTokenError },
    pipelines,
    deals: {
      totalInHubSpot: dealsInHubSpot,
      totalInSupabase: dealsInSupabase ?? 0,
    },
    companies: {
      totalInHubSpot: companiesInHubSpot,
      totalInSupabase: companiesInSupabase ?? 0,
      matched: companiesMatched ?? 0,
    },
    owners: { count: ownersTotal },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
