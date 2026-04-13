import type { Subscription, Invoice, Plan, Customer } from "@/lib/frisbii";

/**
 * Build a test Subscription with sensible defaults. Override any field via spread.
 */
export function buildSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    handle: `sub-${Math.random().toString(36).slice(2, 8)}`,
    state: "active",
    customer: "cust-1",
    plan: "b-scope-1-2-3-standard",
    quantity: 1,
    currency: "DKK",
    created: "2025-01-01T00:00:00Z",
    activated: "2025-01-01T00:00:00Z",
    plan_version: 1,
    ...overrides,
  };
}

/**
 * Build a test Invoice with sensible defaults.
 */
export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    handle: `invoice-${Math.random().toString(36).slice(2, 8)}`,
    state: "settled",
    amount: 500_000, // 5,000 DKK
    currency: "DKK",
    created: "2025-01-01T00:00:00Z",
    customer: "cust-1",
    ...overrides,
  };
}

/**
 * Build a test Plan with sensible defaults.
 */
export function buildPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    handle: "b-scope-1-2-3-standard",
    name: "b-scope-1-2-3-standard", // Frisbii name = handle
    state: "active",
    amount: 500_000, // 5,000 DKK/month
    currency: "DKK",
    interval_length: 1,
    created: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Build a test Customer with sensible defaults.
 */
export function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    handle: `cust-${Math.random().toString(36).slice(2, 8)}`,
    created: "2024-06-01T00:00:00Z",
    active_subscriptions: 1,
    ...overrides,
  };
}
