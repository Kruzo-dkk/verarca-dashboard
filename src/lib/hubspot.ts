const BASE_URL = "https://api-eu1.hubapi.com/crm/v3";

function getAuthHeader(): string {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) throw new Error("HUBSPOT_API_TOKEN is not set");
  return `Bearer ${token}`;
}

// Types
export interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string;
    amount: string | null;
    amount_in_home_currency: string | null;
    createdate: string;
    closedate: string | null;
    days_to_close: string | null;
    dealstage: string;
    hs_deal_stage_probability: string | null;
    hs_forecast_amount: string | null;
  };
}

export interface PipelineStage {
  stageId: string;
  label: string;
  displayOrder: number;
  probability: number;   // 0.0–1.0 decimal
  isClosed: boolean;
}

export interface PipelineMetrics {
  totalPipelineValue: number;    // DKK øre (deal amounts from HubSpot home currency)
  weightedPipeline: number;      // DKK øre, probability-weighted
  dealsWon: number;
  dealsLost: number;
  dealsOpen: number;
  winRate: number;               // percentage
  avgSalesCycleDays: number;
  avgDealSize: number;           // DKK øre
  deals: HubSpotDeal[];
}

// ─── Shared HTTP helpers ────────────────────────────────────────
// Exported so hubspot-companies.ts, hubspot-activities.ts, hubspot-tickets.ts can reuse them.

export async function hubspotFetch<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function hubspotPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function listDeals(): Promise<HubSpotDeal[]> {
  const properties = [
    "dealname", "amount", "amount_in_home_currency", "createdate",
    "closedate", "days_to_close", "dealstage", "hs_deal_stage_probability",
    "hs_forecast_amount"
  ].join(",");

  const all: HubSpotDeal[] = [];
  let after: string | undefined;

  do {
    const url = `/objects/deals?limit=100&properties=${properties}${after ? `&after=${after}` : ""}`;
    const response = await hubspotFetch<{
      results: HubSpotDeal[];
      paging?: { next?: { after: string } };
    }>(url);
    all.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return all;
}

export async function getPipelineStages(): Promise<PipelineStage[]> {
  // Use the pipelines API endpoint
  const response = await fetch(
    "https://api-eu1.hubapi.com/crm/v3/pipelines/deals",
    {
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    }
  );
  if (!response.ok) throw new Error(`HubSpot pipelines error ${response.status}`);
  const data = await response.json();

  // Get the first (default) pipeline's stages
  const pipeline = data.results?.[0];
  if (!pipeline) return [];

  return pipeline.stages.map((s: { id: string; label: string; displayOrder: number; metadata: { probability: string; isClosed: string } }) => ({
    stageId: s.id,  // HubSpot pipeline API returns 'id', not 'stageId'
    label: s.label,
    displayOrder: s.displayOrder,
    // HubSpot returns probability already as a decimal (0.1, 0.3, 1.0)
    probability: parseFloat(s.metadata?.probability ?? "0"),
    isClosed: s.metadata?.isClosed === "true",
  }));
}

export function calculatePipelineMetrics(
  deals: HubSpotDeal[],
  stages: PipelineStage[],
  month?: string // YYYY-MM filter, optional
): PipelineMetrics {
  const stageMap = new Map(stages.map(s => [s.stageId, s]));

  // Filter deals to month if specified
  // For historical accuracy: a deal belongs in month M if:
  //   1. It was CREATED on or before the last day of M, AND
  //   2. It was still OPEN during M (no close date, or closed on/after first day of M)
  // This reconstructs what the pipeline looked like during each month.
  let filtered = deals;
  if (month) {
    const monthStart = `${month}-01`;
    // Calculate last day of month
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

    filtered = deals.filter(d => {
      const createDate = d.properties.createdate?.slice(0, 10);
      const closeDate = d.properties.closedate?.slice(0, 10) ?? null;

      // Deal must have been created on or before the end of this month
      if (createDate && createDate > monthEnd) return false;

      // If deal is closed, it must have closed on or after the start of this month
      // (otherwise it was already closed before this month started)
      if (closeDate && closeDate < monthStart) return false;

      return true;
    });
  }

  // HubSpot uses numeric stage IDs – detect won/lost/open by isClosed + probability
  // isClosed + probability >= 1.0 → won
  // isClosed + probability < 1.0  → lost
  // !isClosed                      → open
  const wonDeals = filtered.filter(d => {
    const stage = stageMap.get(d.properties.dealstage);
    return stage && stage.isClosed && stage.probability >= 1.0;
  });
  const lostDeals = filtered.filter(d => {
    const stage = stageMap.get(d.properties.dealstage);
    return stage && stage.isClosed && stage.probability < 1.0;
  });
  const openDeals = filtered.filter(d => {
    const stage = stageMap.get(d.properties.dealstage);
    return stage && !stage.isClosed;
  });

  // Convert amounts to minor units (øre). Prefer amount_in_home_currency (always DKK)
  // over amount (which may be in deal's local currency like EUR/USD).
  const toOre = (d: HubSpotDeal) => {
    const raw = d.properties.amount_in_home_currency ?? d.properties.amount;
    return Math.round(parseFloat(raw || "0") * 100);
  };

  const totalPipelineValue = openDeals.reduce(
    (sum, d) => sum + toOre(d), 0
  );

  const weightedPipeline = openDeals.reduce((sum, d) => {
    const amount = toOre(d);
    const stage = stageMap.get(d.properties.dealstage);
    return sum + Math.round(amount * (stage?.probability ?? 0));
  }, 0);

  const closedDeals = [...wonDeals, ...lostDeals];
  const winRate = closedDeals.length > 0
    ? (wonDeals.length / closedDeals.length) * 100
    : 0;

  const salesCycles = wonDeals
    .map(d => parseInt(d.properties.days_to_close || "0"))
    .filter(d => d > 0);
  const avgSalesCycleDays = salesCycles.length > 0
    ? salesCycles.reduce((a, b) => a + b, 0) / salesCycles.length
    : 0;

  const wonAmounts = wonDeals.map(d => toOre(d));
  const avgDealSize = wonAmounts.length > 0
    ? wonAmounts.reduce((a, b) => a + b, 0) / wonAmounts.length
    : 0;

  return {
    totalPipelineValue,
    weightedPipeline,
    dealsWon: wonDeals.length,
    dealsLost: lostDeals.length,
    dealsOpen: openDeals.length,
    winRate: Math.round(winRate * 100) / 100,
    avgSalesCycleDays: Math.round(avgSalesCycleDays),
    avgDealSize: Math.round(avgDealSize),
    deals: filtered,
  };
}
