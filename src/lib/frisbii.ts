const BASE_URL = "https://api.frisbii.com/v1";

function getAuthHeader(): string {
  const apiKey = process.env.FRISBII_API_KEY;
  if (!apiKey) throw new Error("FRISBII_API_KEY is not set");
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

interface ListParams {
  from?: string;
  to?: string;
  interval?: string;
  size?: number;
  state?: string | string[];
  next_page_token?: string;
  [key: string]: string | string[] | number | undefined;
}

interface ListResponse<T> {
  size: number;
  count: number;
  content: T[];
  next_page_token?: string;
  from?: string;
  to?: string;
}

export interface Subscription {
  handle: string;
  state: string;
  customer: string;
  plan: string;
  quantity: number;
  amount: number;
  currency: string;
  created: string;
  activated: string;
  cancelled?: string;
  expired?: string;
  trial_start?: string;
  trial_end?: string;
  current_period_start?: string;
  next_period_start?: string;
  plan_version: number;
  discount?: string;
  add_ons?: SubscriptionAddOn[];
}

export interface SubscriptionAddOn {
  handle: string;
  quantity: number;
  amount: number;
}

export interface Invoice {
  id: string;
  handle: string;
  state: string;
  amount: number;
  currency: string;
  created: string;
  settled?: string;
  due?: string;
  customer: string;
  subscription?: string;
  plan?: string;
  period_from?: string;
  period_to?: string;
  dunning_start?: string;
}

export interface Plan {
  handle: string;
  name: string;
  state: string;
  amount: number;
  currency: string;
  interval_length: number;
  schedule_type?: string;
  setup_fee?: number;
  trial_interval_length?: number;
  created: string;
}

export interface Customer {
  handle: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  created: string;
  active_subscriptions: number;
}

async function apiFetch<T>(path: string, params: ListParams = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 }, // cache for 5 minutes
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Frisbii API error ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchAll<T>(path: string, params: ListParams = {}): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;

  do {
    const response = await apiFetch<ListResponse<T>>(path, {
      ...params,
      size: params.size ?? 100,
      ...(nextToken ? { next_page_token: nextToken } : {}),
    });
    all.push(...response.content);
    nextToken = response.next_page_token;
  } while (nextToken);

  return all;
}

export async function listSubscriptions(
  params: ListParams = {}
): Promise<Subscription[]> {
  return fetchAll<Subscription>("/list/subscription", params);
}

export async function listInvoices(
  params: ListParams = {}
): Promise<Invoice[]> {
  return fetchAll<Invoice>("/list/invoice", params);
}

export async function listCustomers(
  params: ListParams = {}
): Promise<Customer[]> {
  return fetchAll<Customer>("/list/customer", params);
}

export async function getPlan(handle: string): Promise<Plan> {
  const result = await apiFetch<Plan | Plan[]>(`/plan/${handle}`);
  return Array.isArray(result) ? result[0] : result;
}

export async function listPlans(
  params: ListParams = {}
): Promise<Plan[]> {
  return fetchAll<Plan>("/list/plan", params);
}
