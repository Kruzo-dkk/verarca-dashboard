# Plan: Fix customer_count derivation inconsistency

## Context

`customer_count` in `monthly_snapshots` is derived from the Frisbii API subscription count (`activeSubscriptions.length`) instead of from `customer_snapshots` rows. This causes phantom customer count changes when subscriptions transition between sync runs, without corresponding churn being detected. The fix unifies all three code paths to use snapshot-based counting.

## Architecture Decision

Use snapshot-based counting (`customer_snapshots` with `status === "active" && mrr > 0`) everywhere. This is already the approach in `backfill-history.ts` and aligns the summary with the detail table. Rejected alternative: counting all active subscriptions from Frisbii — this is a point-in-time API value that doesn't match the month boundary semantics of the snapshot tables.

## Changes

### File 1: `src/lib/sync/sync-frisbii.ts`

Move `customerCount` assignment from line 150 (before snapshots are fetched) to after line 177 (after `currentSnapshots` is computed).

**Current** (line 150):
```typescript
const customerCount = activeSubscriptions.length;
const arpa = Math.round(calculateARPC(mrr, customerCount));
```

**New** (after line 177, after `currentSnapshots` is built):
```typescript
const customerCount = currentSnapshots.filter(
  (s) => s.status === "active" && s.mrr > 0
).length;
const arpa = Math.round(calculateARPC(mrr, customerCount));
```

### File 2: `src/app/api/cron/snapshot/route.ts`

Same change — derive from snapshot query instead of Frisbii API.

**Current** (line 60):
```typescript
const customerCount = activeSubscriptions.length;
```

**New**: Query `customer_snapshots` for the current month and count active with MRR > 0. If no snapshots exist yet (first run of the day), fall back to `activeSubscriptions.length`.

## Tests

### Test file: `src/lib/__tests__/metrics.test.ts`

Add test for `calculateARPC` confirming it correctly excludes zero-MRR customers when given a snapshot-derived count. (This function itself doesn't change — the test documents the expected input contract.)

### Test file: `src/lib/sync/__tests__/sync-frisbii.test.ts` (new)

Test that `syncMonthlySnapshot` writes `customer_count` based on active snapshots with MRR > 0, not raw Frisbii subscription count. This requires mocking Supabase and Frisbii — use the test utilities from `src/test/mocks/`.

## Verification

1. `npm test` — all tests pass
2. `npx tsc --noEmit` — type check passes
3. Manual: after deploy, verify March and April show consistent customer counts derived from snapshots

## Risks

- **ARPA will change** for months where Frisbii count != snapshot count. This is a correction, not a regression — the old values were wrong.
- **Cron route** (`metric_snapshots` daily table) is a separate concern. Fixing it requires a snapshot query in the cron handler, which adds a DB call. Could be deferred.
