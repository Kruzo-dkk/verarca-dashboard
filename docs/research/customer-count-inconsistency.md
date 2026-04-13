# Research: Customer Count Inconsistency

## Problem

March 2026 shows 131 customers, April shows 130, but zero churn is registered and no MRR is lost. The `customer_count` field in `monthly_snapshots` is derived from a different source than the churn/decomposition metrics, creating phantom drops.

## Root Cause

`customer_count` is set from **three different sources** with different definitions of "active":

| File | Line | Definition | Includes 0-MRR? |
|------|------|-----------|-----------------|
| `sync-frisbii.ts` | 150 | `activeSubscriptions.length` (Frisbii API point-in-time) | Yes |
| `backfill-history.ts` | 315 | `snapshots.filter(s => s.status === "active" && s.mrr > 0).length` | No |
| `cron/snapshot/route.ts` | 60 | `activeSubscriptions.length` (Frisbii API point-in-time) | Yes |

The Frisbii API count is a snapshot of the API at sync time. A subscription that transitions between syncs (e.g., goes `on_hold` or expires between March and April sync runs) will drop the count without triggering churn detection (which requires `expired`/`cancelled` date matching the month).

Meanwhile, `customer_snapshots` shows 127 active customers in both months — no change.

## Data Evidence

| Metric | March | April |
|--------|-------|-------|
| `monthly_snapshots.customer_count` | 131 | 130 |
| `customer_snapshots` active rows | 127 | 127 |
| `customer_snapshots` churned rows | 3 | 3 |
| `churned_logos` | 0 | 0 |
| `churned_mrr` | 0 | 0 |

## Downstream Impact

`customer_count` feeds into:
- **ARPA** (`calculateARPC(mrr, customerCount)`) — denominator change affects value
- **LTV** (via ARPA) — proportional change
- **Monthly churn rate** (`churned_logos / (customerCount + churned_logos) * 100`)
- **Display**: CustomerSection.tsx, InvestorDashboard.tsx

## Fix

Unify all three locations to derive `customer_count` from `customer_snapshots`:
```
customerCount = currentSnapshots.filter(s => s.status === "active" && s.mrr > 0).length
```

This matches `backfill-history.ts` (already correct) and ensures the summary table aligns with the detail table.

The cron route (`metric_snapshots`) is a separate daily table — it should also use snapshot-based counting for consistency, but could be addressed separately.
