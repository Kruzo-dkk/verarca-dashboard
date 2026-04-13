import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Returns a Set of subscription handles that should be excluded
 * from churn calculations (administrative replacements, test subs, etc.).
 */
export async function getExcludedSubscriptionHandles(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_exclusions")
    .select("subscription_handle");

  if (error) {
    console.warn(
      "[get-exclusions] Failed to fetch exclusions:",
      error.message
    );
    return new Set();
  }

  return new Set((data ?? []).map((r) => r.subscription_handle));
}

/**
 * Returns a Map of customer_handle -> replacement_subscription_handle
 * for linking old subscriptions to their replacements.
 *
 * Used by decomposeMRR to prevent false churn+new accounting
 * when a customer's subscription handle changes.
 */
export async function getReplacementMap(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_exclusions")
    .select("customer_handle, replacement_subscription_handle")
    .not("replacement_subscription_handle", "is", null);

  if (error) {
    console.warn(
      "[get-exclusions] Failed to fetch replacements:",
      error.message
    );
    return new Map();
  }

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.replacement_subscription_handle) {
      map.set(row.customer_handle, row.replacement_subscription_handle);
    }
  }
  return map;
}
