# Plan: Fix MRR Reconciliation Mismatch

## Context

`monthly_snapshots.mrr` and `SUM(customer_snapshots.mrr)` diverge by 15,261 DKK (April) because they use different definitions of "active" — point-in-time Frisbii API state vs. month-boundary overlap. The fix makes customer_snapshots the single source of truth for all aggregate metrics, eliminating the reconciliation mismatch.

## Architecture Decision

Derive `monthly_snapshots.mrr` from `customer_snapshots` (already computed earlier in the sync pipeline) rather than independently from the Frisbii API. This is the same pattern as the `customer_count` fix and ensures the summary table is always consistent with the detail table.

The Frisbii API MRR calculation (`calculateMRR`) remains available for the reconciliation check to compare cross-system, but is no longer the value stored in `monthly_snapshots`.

## Changes

### File 1: `src/lib/sync/sync-frisbii.ts`

After `currentSnapshots` is built (line 176), derive `mrr` and `arr` from snapshots instead of from `calculateMRR`:

**Current** (line 148-150):
```typescript
const mrr = Math.round(calculateMRR(activeSubscriptions, planMap, addOnTotals));
const arr = calculateARR(mrr);
```

**New** (after line 177, alongside customerCount):
```typescript
// Frisbii API MRR for cross-system comparison logging
const frisbiiMRR = Math.round(calculateMRR(activeSubscriptions, planMap, addOnTotals));

// ... after currentSnapshots is built ...

// Derive MRR from customer snapshots (single source of truth)
const mrr = currentSnapshots
  .filter((s) => s.status === "active")
  .reduce((sum, s) => sum + s.mrr, 0);
const arr = calculateARR(mrr);
const customerCount = countActiveCustomers(currentSnapshots);
const arpa = Math.round(calculateARPC(mrr, customerCount));
```

Log the Frisbii comparison for operational visibility:
```typescript
syncLog.info(
  `[sync-frisbii] MRR: snapshot=${mrr}, frisbii=${frisbiiMRR}, delta=${Math.abs(mrr - frisbiiMRR)}`
);
```

### File 2: `src/lib/sync/validate-sync.ts`

Update the reconciliation check to compare `monthly_snapshots.mrr` against the Frisbii API value (cross-system check) instead of against customer_snapshots (which is now the same source). This makes the check actually useful — it detects when Frisbii and Supabase diverge.

**Current**: compares `monthly_snapshots.mrr` vs `SUM(customer_snapshots.mrr)`
**New**: compares `monthly_snapshots.mrr` vs `calculateMRR(frisbiiSubscriptions)` — true cross-source reconciliation

## Tests

### `src/lib/__tests__/metrics.test.ts`
No new tests needed — `calculateMRR` and `countActiveCustomers` are already tested.

### Verification
After deploy, the next sync run should show:
- `mrr_reconciliation` check: **pass** (monthly_snapshots now derived from snapshots)
- `monthly_snapshots.mrr` for April should update to ~32,935,010 (matching customer_snapshots)

## Risks

- **MRR will jump** from 31,408,943 to ~32,935,010 (a ~1,526,067 øre / 15,261 DKK increase). This is a correction — the old value was wrong (undercounting mid-month churn reversals).
- **Historical months won't update** until a backfill is run. March will still show the old lower value.
- **ARR, ARPA, and growth rates** will change as a downstream effect. This is expected.
