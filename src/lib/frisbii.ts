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
  amount?: number;
  currency: string;
  created: string;
  activated?: string;
  cancelled_date?: string;
  expired_date?: string;
  trial_start?: string;
  trial_end?: string;
  current_period_start?: string;
  next_period_start?: string;
  plan_version: number;
  discount?: string;
  subscription_add_ons?: string[];
  subscription_discounts?: string[];
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

export interface AddOn {
  handle: string;
  name: string;
  amount: number;
  currency?: string;
  interval_length?: number;
}

export interface Customer {
  handle: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  created: string;
  active_subscriptions: number;
}

// ─── Discount types ───────────────────────────────────────────

export interface Discount {
  handle: string;
  name: string;
  description?: string;
  amount?: number;           // fixed amount discount (øre)
  percentage?: number;       // percentage discount (0-100)
  state: string;             // "active" | "deleted"
  apply_to?: string[];       // which plans/add-ons
  created: string;
}

export interface SubscriptionDiscount {
  handle: string;
  discount: string;          // handle of the base discount
  name?: string;
  amount?: number;           // fixed amount override
  percentage?: number;       // percentage override
  state: string;
  expires?: string;          // ISO date when discount expires
  created: string;
}

/** A non-2xx Frisbii response, carrying the HTTP status for retry decisions. */
export class FrisbiiApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "FrisbiiApiError";
  }
}

/** Retry rate-limit (429) + server (5xx) responses and transient network errors. */
function isRetryableFrisbiiError(err: unknown): boolean {
  if (err instanceof FrisbiiApiError) return err.status === 429 || err.status >= 500;
  return true; // network / unknown transient error
}

async function apiFetch<T>(
  path: string,
  params: ListParams = {},
  opts: { noStore?: boolean } = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  // Frisbii enforces ~25 read req/sec. No-store paginated lists + per-subscription
  // add-on calls can burst past that, so retry 429/5xx with backoff (1s, 2s, 4s, 8s)
  // rather than failing a whole sync on a transient spike. 4xx (other than 429)
  // fail fast.
  return withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        // Token-paginated lists MUST NOT be cached: the Data Cache keys by URL, so
        // a cached page returns a stale cursor token and the chain never reaches
        // pages of records added after the cache filled — silently dropping the
        // newest subscriptions/customers from every sync (see fetchAll). Single-
        // object reads (by handle) stay on the 5-minute cache.
        ...(opts.noStore
          ? { cache: "no-store" as const }
          : { next: { revalidate: 300 } }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new FrisbiiApiError(res.status, `Frisbii API error ${res.status}: ${body}`);
      }

      return res.json() as Promise<T>;
    },
    4,
    1000,
    isRetryableFrisbiiError
  );
}

async function fetchAll<T>(path: string, params: ListParams = {}): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;

  do {
    const response = await apiFetch<ListResponse<T>>(
      path,
      {
        // Frisbii defaults to range=created with a 1-month window,
        // so without an explicit `from` it only returns recently-created records.
        from: "2020-01-01",
        ...params,
        size: params.size ?? 100,
        ...(nextToken ? { next_page_token: nextToken } : {}),
      },
      { noStore: true }
    );
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

export async function getAddOn(handle: string): Promise<AddOn> {
  return apiFetch<AddOn>(`/add_on/${handle}`);
}

/** Add-on as attached to a specific subscription (includes subscription-specific amount) */
export interface SubscriptionAddOnDetail {
  handle: string;
  amount: number;
  currency?: string;
  add_on?: { name: string; amount: number };
}

/**
 * Fetch the add-ons attached to a specific subscription.
 * Returns the subscription-specific amounts (which may differ from the base add-on definition).
 */
export async function getSubscriptionAddOns(
  subscriptionHandle: string
): Promise<SubscriptionAddOnDetail[]> {
  return apiFetch<SubscriptionAddOnDetail[]>(
    `/subscription/${subscriptionHandle}/add_on`
  );
}

/**
 * Build a plan map keyed by handle, keeping only the active version
 * when multiple versions exist (active > superseded > deleted).
 */
export function buildPlanMap(plans: Plan[]): Map<string, Plan> {
  const map = new Map<string, Plan>();
  for (const plan of plans) {
    const existing = map.get(plan.handle);
    if (!existing || plan.state === "active") {
      map.set(plan.handle, plan);
    }
  }
  return map;
}

// ─── Discount API functions ──────────────────────────────────────

/**
 * Fetch a single discount definition by handle.
 */
export async function getDiscount(handle: string): Promise<Discount> {
  return apiFetch<Discount>(`/discount/${handle}`);
}

/**
 * Fetch the discounts attached to a specific subscription.
 * Returns the subscription-level discount details (may include overrides).
 */
export async function getSubscriptionDiscounts(
  subscriptionHandle: string
): Promise<SubscriptionDiscount[]> {
  try {
    const result = await apiFetch<SubscriptionDiscount[]>(
      `/subscription/${subscriptionHandle}/discount`
    );
    return Array.isArray(result) ? result : [];
  } catch {
    // Subscription may not have discounts endpoint, return empty
    return [];
  }
}

/**
 * Fetch discount details for all subscriptions that have discounts.
 * Returns a map of subscription handle → array of discount details.
 */
export async function fetchSubscriptionDiscountDetails(
  subscriptions: Subscription[]
): Promise<Map<string, SubscriptionDiscount[]>> {
  const subsWithDiscounts = subscriptions.filter(
    (s) =>
      (s.subscription_discounts && s.subscription_discounts.length > 0) ||
      s.discount
  );

  const results = await Promise.all(
    subsWithDiscounts.map(async (sub): Promise<[string, SubscriptionDiscount[]]> => {
      try {
        const discounts = await getSubscriptionDiscounts(sub.handle);
        return [sub.handle, discounts];
      } catch {
        return [sub.handle, []];
      }
    })
  );

  return new Map(results);
}

/**
 * Map over items with a bounded number of in-flight async tasks, preserving
 * input order. Rejects (does not swallow) if any task throws.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Retry an async fn on failure with exponential backoff. Throws the last error
 * once retries are exhausted — callers must NOT convert a persistent failure
 * into a silent default (that's how add-on revenue was being dropped from MRR).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 250,
  shouldRetry: (err: unknown) => boolean = () => true
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= retries || !shouldRetry(err)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr; // unreachable
}

/**
 * Fetch subscription-specific add-on amounts for all subscriptions that have
 * add-ons. Returns a map of subscription handle → total add-on amount per
 * billing period.
 *
 * Add-on amounts require a per-subscription call (the list endpoint only carries
 * add-on HANDLES). Firing all of them at once rate-limited Frisbii, and the old
 * code silently caught the failure as 0 — quietly dropping ~17% of MRR. Now the
 * calls are concurrency-capped + retried, and a persistent failure THROWS so the
 * sync fails loudly instead of writing an under-counted MRR.
 */
const ADDON_FETCH_CONCURRENCY = 6;

export async function fetchSubscriptionAddOnTotals(
  subscriptions: Subscription[]
): Promise<Map<string, number>> {
  const subsWithAddOns = subscriptions.filter(
    (s) => s.subscription_add_ons && s.subscription_add_ons.length > 0
  );

  const results = await mapWithConcurrency(
    subsWithAddOns,
    ADDON_FETCH_CONCURRENCY,
    async (sub) => {
      const addOns = await getSubscriptionAddOns(sub.handle);
      const total = addOns.reduce((sum, a) => sum + (a.amount || 0), 0);
      return [sub.handle, total] as const;
    }
  );

  return new Map(results);
}
