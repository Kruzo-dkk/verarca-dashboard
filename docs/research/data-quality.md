# Research: Data Quality — Churn & Turnover Loss Accuracy

## What exists today

### Data flow: Frisbii → Supabase → Dashboard

```
Frisbii API (all subs since 2020-01-01)
  → sync-customers.ts       → customers table (current state)
  → sync-customer-snapshots  → customer_snapshots table (per-customer, per-month MRR)
  → sync-frisbii.ts          → monthly_snapshots table (aggregated metrics)
  → metrics.ts               → churn rate, MRR decomposition, NRR, GRR
  → report-data.ts           → dashboard display
```

### How churn is currently calculated

**Churn rate** (`getMonthlyChurn` in `metrics.ts:142`):
- Counts subscriptions with `state === "expired"` that expired within the month
- Divides by subscriptions active at month start
- Only counts `expired` state — does NOT count `cancelled`

**Churned MRR** (`decomposeMRR` in `metrics.ts:250`):
- Compares `customer_snapshots` month-over-month
- Customer present in previous month but absent in current = churned
- Uses `customer_id` as the identity key

**Churned logos** (`sync-frisbii.ts:111`):
- Counts subscriptions where `expired` or `cancelled` date falls within the month
- Uses raw Frisbii subscription data, not customer_snapshots

### How deleted/recreated subscriptions flow through

When Verarca deletes and recreates a subscription in Frisbii:

1. **Old subscription**: remains in Frisbii API with `expired` or `cancelled` state
2. **New subscription**: new handle, new `created` date, `active` state
3. **Customer handle**: stays the same (the Frisbii customer is not deleted)

**Impact on sync:**
- `sync-customers.ts:91-102` sorts subscriptions: active first, then most-recent. Only the first match per customer handle is kept → the new active sub wins
- `sync-customer-snapshots.ts:114-119` also picks first match per customer → new sub wins
- **But**: `sync-frisbii.ts:111` counts ALL subs that expired/cancelled in the month, including the deliberately-deleted old one → **inflates churned_logos**
- `getMonthlyChurn` in metrics.ts similarly counts the old expired sub → **inflates churn rate**
- `decomposeMRR`: if both old and new exist in the same month's snapshots, the customer stays present → MRR decomposition is correct (no false churn). But if the old sub expires in month N and the new one activates in month N+1, there's a 1-month gap → **false churn in MRR decomposition**

### Where there is no validation today

| Area | Gap |
|------|-----|
| Subscription deduplication | No detection of delete/recreate patterns |
| Data completeness | No check for missing `activated` dates (falls back to `created` silently) |
| Cross-source reconciliation | No comparison of Frisbii total vs. Supabase total |
| Anomaly detection | No alerts on sudden jumps in churn, MRR, or customer count |
| Snapshot consistency | No check that customer_snapshots sum equals monthly_snapshot MRR |
| Historical immutability | Re-running sync for past months overwrites snapshots silently |
| Audit trail | No logging of what changed between syncs |

## Files affected

| File | Issue |
|------|-------|
| `src/lib/metrics.ts:142-185` | `getMonthlyChurn` counts deleted subs as real churn |
| `src/lib/sync/sync-frisbii.ts:111` | `churnedThisMonth` counts deleted subs as churned logos |
| `src/lib/sync/sync-customer-snapshots.ts:114-119` | First-match-wins can pick wrong sub if ordering is ambiguous |
| `src/lib/sync/sync-customers.ts:91-102` | Subscription selection has no awareness of delete/recreate |
| `src/lib/frisbii.ts:148-166` | `fetchAll` has no data integrity checks (count vs returned, missing fields) |
| `src/app/api/cron/snapshot/route.ts` | No post-sync validation step |

## Specific data quality problems

### Problem 1: Deleted subscriptions inflate churn

When a sub is deleted and recreated, the old sub shows as `expired`/`cancelled`. Both `getMonthlyChurn` and `isChurnedInMonth` count it. The customer never actually left.

**Signature**: Customer has both a churned sub and an active sub with overlapping or adjacent dates.

### Problem 2: Gap between delete and recreate causes false MRR churn

If old sub expires 2025-03-15 and new sub activates 2025-04-01, the March→April MRR decomposition shows this customer as churned in March and new in April. This double-counts: inflates both `churned_mrr` and `new_mrr`.

### Problem 3: Churn rate vs churned logos inconsistency

- `getMonthlyChurn` only counts `expired` state
- `isChurnedInMonth` counts both `expired` and `cancelled`
- These produce different numbers for the same month

### Problem 4: No snapshot immutability

Re-running `syncMonthlySnapshot("2025-01")` today overwrites the January snapshot with today's Frisbii data, which may have changed (e.g., a sub that was `active` in January may now show as `cancelled` retroactively).

### Problem 5: No reconciliation between aggregated and per-customer data

`monthly_snapshots.mrr` is calculated from live Frisbii `active` subscriptions.
`customer_snapshots` MRR is calculated from historical `wasActiveDuringMonth` logic.
These use different subscription sets and can diverge.

## Edge cases

- Customer with multiple concurrent subscriptions (rare but possible) — only one is tracked
- Subscription activated after month-end but created during month — not counted (correct)
- Subscription with no `activated` date — falls back to `created`, which may be days/weeks before actual billing start
- Trial subscriptions that never activate — may appear in `created` counts
- Plan price changes mid-month — snapshot captures end-of-month price, not weighted average
