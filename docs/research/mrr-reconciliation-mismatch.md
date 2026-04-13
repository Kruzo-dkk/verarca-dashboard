# Research: MRR Reconciliation Mismatch

## Problem

The `mrr_reconciliation` check fails on **every single sync run** (501 consecutive failures). It compares `monthly_snapshots.mrr` against `SUM(customer_snapshots.mrr WHERE status='active')` and finds a growing gap:

| Month | monthly_snapshots.mrr | SUM(customer_snapshots) | Gap (DKK) |
|-------|----------------------|------------------------|-----------|
| Feb   | 31,380,960           | 31,380,960             | 0         |
| Mar   | 31,780,660           | 32,770,060             | 9,894     |
| Apr   | 31,408,943           | 32,935,010             | 15,261    |

Customer snapshots are consistently **higher** than the monthly aggregate, and the gap is widening.

## Root Cause: Different Definitions of "Active"

The two MRR values are computed by different code paths with different "active" filters:

### Path 1: `monthly_snapshots.mrr` (sync-frisbii.ts:149)
```
calculateMRR(activeSubscriptions, planMap, addOnTotals)
where activeSubscriptions = allSubscriptions.filter(s => s.state === "active")
```
**Point-in-time filter**: only subscriptions currently in `"active"` state when the API is called.

### Path 2: `customer_snapshots.mrr` (sync-customer-snapshots.ts:43-58)
```
wasActiveDuringMonth(sub, month):
  activated/created <= monthEnd AND (no endDate OR endDate >= monthStart)
```
**Time-range filter**: any subscription that overlapped with the month, including those that expired/cancelled partway through.

### How this creates the gap

A subscription that was active on April 5 but expired on April 10:
- **Path 1**: excluded (state is now `"expired"`, not `"active"`)
- **Path 2**: included (it was active during April — `wasActiveDuringMonth` returns true)

The subscription's MRR gets counted in customer_snapshots but not in monthly_snapshots. As more subscriptions churn mid-month over time, the gap grows.

## Why Feb matched

In Feb, the sync likely ran while no subscriptions had expired mid-month, or the timing was such that the Frisbii API state and the month-boundary logic agreed. As more churn accumulated (even churn later reversed by replacements), the divergence appeared.

## The MRR calculations themselves are identical

Both paths use the same formula:
```
(plan.amount × quantity) / interval_length + addOnTotal / interval_length
```
No discount handling in either. The divergence is entirely in **which subscriptions** are included.

## Fix

The `monthly_snapshots.mrr` should be derived from `customer_snapshots` (the source of truth) rather than independently calculated from the Frisbii API. This is the same pattern as the `customer_count` fix — use the snapshot table as the single source of truth.

Specifically, in `sync-frisbii.ts`, after customer snapshots are fetched (line 176):
```typescript
const mrr = currentSnapshots
  .filter(s => s.status === "active")
  .reduce((sum, s) => sum + s.mrr, 0);
```

This ensures `monthly_snapshots.mrr === SUM(customer_snapshots.mrr WHERE active)` by definition.

## Impact

- ARPA, ARR, and all MRR-derived metrics will change to reflect the snapshot-based value
- The reconciliation check will always pass (by construction)
- The reconciliation check should be updated to compare against a different source (e.g., Frisbii API total) to still provide value as a cross-system check
