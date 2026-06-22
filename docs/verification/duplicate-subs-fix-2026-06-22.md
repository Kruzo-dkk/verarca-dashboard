# Verification — collapse identical duplicate subscriptions (2026-06-22)

Golden-master baseline + expected-delta gate for `fix/collapse-identical-duplicate-subs`.
All figures in DKK øre. Captured read-only from production before the change.

## Baseline — `monthly_snapshots` (pre-change)

| month | mrr | expansion_mrr | nrr | grr | customer_count |
|---|---|---|---|---|---|
| 2025-07 | 3,791,560 | 0 | 0 | 0 | 23 |
| 2025-08 | 11,022,227 | 0 | 100 | 100 | 60 |
| 2025-09 | 12,704,027 | 282,400 | 102.56 | 100 | 65 |
| 2025-10 | 14,763,127 | 219,900 | 101.65 | 100 | 74 |
| 2025-11 | 17,062,527 | 0 | 98.7 | 98.7 | 81 |
| 2025-12 | 19,465,877 | 460,100 | 97.79 | 95.19 | 88 |
| 2026-01 | 27,254,977 | 0 | 98.75 | 98.75 | 98 |
| 2026-02 | 28,294,277 | 160,000 | 99.1 | 98.53 | 105 |
| 2026-03 | 29,443,577 | 0 | 99.17 | 99.17 | 112 |
| 2026-04 | 29,950,377 | 0 | 98.66 | 98.66 | 117 |
| 2026-05 | 31,349,277 | 0 | 98.33 | 98.33 | 128 |
| 2026-06 | 33,108,877 | 0 | 98.74 | 98.74 | 136 |

Pre-change validation state: `mrr_reconciliation` was **FAILING for 2026-06** (delta 179,800 —
ALULINE re-signup: 3 active snapshot rows, top-K keeps 1, but the raw active sum counted all 3).
The collapse-aware reconciliation in this change fixes that.

## Expected-delta gate (June 2026) — verified read-only against real group data

New collapse = de-dup active members sharing `(cvr, plan, mrr)` → then existing top-K.
Only same-CVR identical duplicates collapse; different-CVR (Madsen-Kastberg, Tina) and
different-amount (Consensus) are correctly preserved.

| group | raw | collapsed | removed |
|---|---|---|---|
| cust-0004 DMR (diff plan+cvr) | 503,760 | 503,760 | 0 |
| cust-0016 Consensus (same cvr, diff amount) | 339,800 | 339,800 | 0 |
| cust-0045 Malerfirmaet (same cvr+plan+amount) | 439,800 | 219,900 | **219,900** |
| cust-0073 lmpihl (same cvr+plan+amount) | 919,800 | 459,900 | **459,900** |
| cust-0165 Madsen-Kastberg (3 diff cvr) | 249,700 | 249,700 | 0 |
| cust-0179 Tina Olesen (diff cvr) | 299,800 | 299,800 | 0 |
| cust-0191 ALULINE (re-signup) | 269,700 | 89,900 | 179,800 (already removed by top-K today) |

**New June `mrr` = 32,429,077** (raw active 33,288,677 − 859,600).
vs current `monthly_snapshots.mrr` 33,108,877 → **drop = 679,800 øre = kr 6,798** (lmpihl + Malerfirmaet only).
`expansion_mrr` stays 0. `mrr_reconciliation`: collapsed customer sum 32,429,077 == new monthly mrr → **PASS**.

Reproduce: `python3` block in the commit / PR description, or re-run the read-only group query.

## Post-deploy verification (run after backfill on the deployed change)

```sql
SELECT month, mrr, expansion_mrr FROM monthly_snapshots WHERE month IN ('2026-05','2026-06');
-- expect 2026-06 mrr = 32,429,077 (was 33,108,877), expansion_mrr = 0
```
Then `validateSync` for all months must be green:
`mrr_reconciliation` pass, `mrr_waterfall_identity` pass, `nrr_grr_consistency` pass,
`duplicate_active_subscriptions` warn listing lmpihl + Malerfirmaet (sameCvr) and
Madsen-Kastberg + Tina (cross-CVR, informational), `expansion_anomaly` pass.

Watch-list customer_snapshots rows are UNCHANGED (dedup happens at collapse time, not stored
per-customer) — only `monthly_snapshots` aggregates (mrr/arr/arpa/nrr/grr) move, for months where
the lmpihl (from 2025-09) and Malerfirmaet (from 2025-10) pairs were both active.
