const BASE_URL = "https://api-eu1.hubapi.com/crm/v3";

function getAuthHeader(): string {
  const token = process.env.HUBSPOT_API_TOKEN;
  if (!token) throw new Error("HUBSPOT_API_TOKEN is not set");
  return `Bearer ${token}`;
}

async function hubspotFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }
  return res.json();
}

async function hubspotPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------- Types ----------

interface HubSpotSearchResponse {
  results: { id: string; properties: Record<string, string | null> }[];
  paging?: { next?: { after: string } };
}

interface HubSpotOwnersResponse {
  results: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
}

interface ActivityRecord {
  timestamp: string;
  ownerId: string;
}

export interface DailyOwnerActivity {
  date: string;
  ownerId: string;
  ownerName: string;
  calls: number;
  meetings: number;
  emails: number;
}

// ---------- Helpers ----------

function buildTimestampFilter(
  startDate: string,
  endDate: string,
  extraFilters: { propertyName: string; operator: string; value: string }[] = []
) {
  const startMs = new Date(startDate).getTime().toString();
  const endMs = new Date(endDate).getTime().toString();
  return [
    {
      propertyName: "hs_timestamp",
      operator: "GTE",
      value: startMs,
    },
    {
      propertyName: "hs_timestamp",
      operator: "LTE",
      value: endMs,
    },
    ...extraFilters,
  ];
}

async function paginateSearch(
  objectType: string,
  filters: { propertyName: string; operator: string; value: string }[],
  properties: string[]
): Promise<{ id: string; properties: Record<string, string | null> }[]> {
  const all: { id: string; properties: Record<string, string | null> }[] = [];
  let after: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const body: Record<string, unknown> = {
      filterGroups: [{ filters }],
      properties,
      limit: 100,
    };
    if (after) body.after = after;

    const data = await hubspotPost<HubSpotSearchResponse>(
      `/objects/${objectType}/search`,
      body
    );
    all.push(...data.results);

    if (data.paging?.next?.after) {
      after = data.paging.next.after;
    } else {
      break;
    }
  }

  return all;
}

// ---------- Exported fetch functions ----------

export async function fetchCalls(
  startDate: string,
  endDate: string
): Promise<ActivityRecord[]> {
  const filters = buildTimestampFilter(startDate, endDate);
  const results = await paginateSearch("calls", filters, [
    "hs_timestamp",
    "hubspot_owner_id",
    "hs_call_status",
  ]);

  return results.map((r) => ({
    timestamp: r.properties.hs_timestamp ?? "",
    ownerId: r.properties.hubspot_owner_id ?? "",
  }));
}

export async function fetchMeetings(
  startDate: string,
  endDate: string
): Promise<ActivityRecord[]> {
  const filters = buildTimestampFilter(startDate, endDate);
  const results = await paginateSearch("meetings", filters, [
    "hs_timestamp",
    "hubspot_owner_id",
  ]);

  return results.map((r) => ({
    timestamp: r.properties.hs_timestamp ?? "",
    ownerId: r.properties.hubspot_owner_id ?? "",
  }));
}

export async function fetchEmails(
  startDate: string,
  endDate: string
): Promise<ActivityRecord[]> {
  const filters = buildTimestampFilter(startDate, endDate, [
    {
      propertyName: "hs_email_direction",
      operator: "EQ",
      value: "EMAIL",
    },
  ]);
  const results = await paginateSearch("emails", filters, [
    "hs_timestamp",
    "hubspot_owner_id",
    "hs_email_direction",
  ]);

  return results.map((r) => ({
    timestamp: r.properties.hs_timestamp ?? "",
    ownerId: r.properties.hubspot_owner_id ?? "",
  }));
}

export async function fetchOwnerNames(): Promise<Map<string, string>> {
  const data = await hubspotFetch<HubSpotOwnersResponse>(
    "/owners?limit=100"
  );
  const map = new Map<string, string>();
  for (const owner of data.results) {
    const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
    map.set(owner.id, name || owner.id);
  }
  return map;
}

export async function fetchAllActivities(
  startDate: string,
  endDate: string
): Promise<DailyOwnerActivity[]> {
  const [calls, meetings, emails, ownerNames] = await Promise.all([
    fetchCalls(startDate, endDate),
    fetchMeetings(startDate, endDate),
    fetchEmails(startDate, endDate),
    fetchOwnerNames(),
  ]);

  // Group by ownerId + date
  const key = (ownerId: string, date: string) => `${ownerId}|${date}`;
  const buckets = new Map<
    string,
    { date: string; ownerId: string; calls: number; meetings: number; emails: number }
  >();

  function ensureBucket(ownerId: string, timestamp: string) {
    const date = timestamp.slice(0, 10); // YYYY-MM-DD from ISO string
    const k = key(ownerId, date);
    if (!buckets.has(k)) {
      buckets.set(k, { date, ownerId, calls: 0, meetings: 0, emails: 0 });
    }
    return buckets.get(k)!;
  }

  function toISO(ts: string): string {
    // hs_timestamp can be ms epoch or ISO string
    if (/^\d+$/.test(ts)) {
      return new Date(Number(ts)).toISOString();
    }
    return ts;
  }

  for (const c of calls) {
    if (!c.ownerId) continue;
    ensureBucket(c.ownerId, toISO(c.timestamp)).calls++;
  }
  for (const m of meetings) {
    if (!m.ownerId) continue;
    ensureBucket(m.ownerId, toISO(m.timestamp)).meetings++;
  }
  for (const e of emails) {
    if (!e.ownerId) continue;
    ensureBucket(e.ownerId, toISO(e.timestamp)).emails++;
  }

  return Array.from(buckets.values()).map((b) => ({
    ...b,
    ownerName: ownerNames.get(b.ownerId) ?? b.ownerId,
  }));
}
