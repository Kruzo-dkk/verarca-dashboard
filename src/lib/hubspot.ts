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
  totalPipelineValue: number;    // USD cents, open deals
  weightedPipeline: number;      // USD cents, probability-weighted
  dealsWon: number;
  dealsLost: number;
  dealsOpen: number;
  winRate: number;               // percentage
  avgSalesCycleDays: number;
  avgDealSize: number;           // USD cents
  deals: HubSpotDeal[];
}

// Fetch functions
async function hubspotFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
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
  let filtered = deals;
  if (month) {
    filtered = deals.filter(d => {
      const closeDate = d.properties.closedate;
      if (closeDate && closeDate.startsWith(month)) return true;
      // Include open deals regardless of month
      const stage = stageMap.get(d.properties.dealstage);
      if (stage && !stage.isClosed) return true;
      return false;
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

  // Convert dollar amounts to cents
  const toCents = (val: string | null) => Math.round(parseFloat(val || "0") * 100);

  const totalPipelineValue = openDeals.reduce(
    (sum, d) => sum + toCents(d.properties.amount), 0
  );

  const weightedPipeline = openDeals.reduce((sum, d) => {
    const amount = toCents(d.properties.amount);
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

  const wonAmounts = wonDeals.map(d => toCents(d.properties.amount));
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
