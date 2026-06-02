# Full Execution Plan: Verarca World-Class Dashboard

**Date**: 2026-04-15
**Approach**: Spec/Test-Driven Development (TDD) with parallel workers
**Estimated total**: 4 waves, ~2 weeks

---

## TDD Standard (Enforced Going Forward)

Every task follows this sequence — no exceptions:

```
1. SPEC    → Write acceptance criteria in the test file header comment
2. TEST    → Write failing tests that encode the spec
3. VERIFY  → Run tests, confirm they fail for the RIGHT reason
4. BUILD   → Write minimal code to pass tests
5. VERIFY  → Run tests, confirm green
6. REFINE  → Refactor if needed — tests must stay green
```

Each worker produces a single PR per task. PR must include:
- Spec comment at top of test file
- Tests + implementation in same commit
- `npm test` passing
- `npx tsc --noEmit` clean

---

## Wave 1: Cleanup + Foundation (Day 1-2)

**All 4 workers run in parallel — zero dependencies between them.**

### Worker 1A: Dead Code Removal
**Scope**: Delete unused files, remove dead API routes

Files to DELETE (zero imports confirmed):
- `src/components/KPICard.tsx`
- `src/components/RevenueChart.tsx`
- `src/components/ChurnChart.tsx`
- `src/components/SubscriptionTable.tsx`
- `src/app/api/revenue/route.ts`
- `src/app/api/metrics/route.ts`
- `src/app/api/churn/route.ts`
- `src/app/api/subscriptions/route.ts`

Files to MOVE (backfill scripts → scripts/):
- `src/app/api/cron/backfill/route.ts` → `scripts/backfill-history.ts`
- `src/app/api/cron/backfill-hubspot/route.ts` → `scripts/backfill-hubspot.ts`
- `src/app/api/cron/backfill-pipeline/route.ts` → `scripts/backfill-pipeline.ts`
- `src/app/api/cron/backfill-plan-names/route.ts` → `scripts/backfill-plan-names.ts`

Update `vercel.json` to remove any cron entries pointing to deleted routes.

**TDD**: Write a test that verifies remaining API routes are valid (import check / route manifest test).

**Verification**: `npx tsc --noEmit && npm test && npm run build`

---

### Worker 1B: Error Boundaries
**Scope**: Add React error boundaries at layout and section levels

**Spec**:
- Dashboard layout catches unhandled errors in any child page
- Each major section (revenue, retention, pipeline, customers) catches errors independently
- Error UI shows: what section failed, a retry button, and does NOT crash siblings
- Error state is visually consistent with the design system (glass card, coral accent for error)

**Files to create**:
- `src/components/ui/ErrorBoundary.tsx` — reusable class component
- `src/components/ui/SectionErrorFallback.tsx` — fallback UI component

**Files to modify**:
- `src/app/(dashboard)/layout.tsx` — wrap children in top-level ErrorBoundary
- `src/components/report/UnifiedDashboard.tsx` — wrap each section
- `src/components/sales/SalesDashboard.tsx` — wrap each section
- `src/components/cs/CSDashboard.tsx` — wrap each section

**TDD**: 
- Test ErrorBoundary catches thrown errors and renders fallback
- Test SectionErrorFallback renders retry button and error message
- Test that sibling sections remain visible when one throws

**Verification**: `npm test` + manual: throw error in one section, verify others survive

---

### Worker 1C: TDD Infrastructure Hardening
**Scope**: Establish spec/test conventions, add missing test utilities, document the TDD standard

**Files to create**:
- `src/test/mocks/admin.ts` — dedicated admin client mock (currently inline in each test)
- `src/test/helpers.ts` — shared test helpers (e.g., `buildMonth()`, `buildCustomerSnapshot()`)
- `src/test/README.md` — TDD conventions doc for contributors

**Files to modify**:
- `vitest.config.ts` — add coverage for `src/app/api/**/*.ts` (API routes)
- `CLAUDE.md` — add TDD enforcement section referencing this plan

**Spec for test helpers**:
```typescript
// buildMonth("2026-03") → "2026-03"
// buildMonth() → current month
// buildCustomerSnapshot({ mrr: 50000 }) → full snapshot with defaults
// buildMonthlySnapshot({ mrr: 500000 }) → full monthly snapshot
// buildPipelineSnapshot({ deals_won: 3 }) → full pipeline snapshot
```

**TDD**: Write tests for the test helpers themselves (meta-tests ensure builders produce valid shapes).

---

### Worker 1D: API Route Manifest Test
**Scope**: Create a route inventory test that documents and validates all remaining API routes

**Spec**:
- Test enumerates all route files under `src/app/api/`
- Asserts each exports either GET, POST, PUT, or DELETE
- Asserts no route file is empty
- Documents the intended route structure as a living spec

**File to create**:
- `src/app/api/__tests__/route-manifest.test.ts`

**Purpose**: This test catches accidentally deleted or broken routes during future refactoring. It also serves as documentation of the API surface.

---

## Wave 2: Sync Module Tests (Day 3-7)

**All 4 workers run in parallel. Each writes specs + tests for independent sync modules.**

Depends on: Wave 1C (test helpers) being merged first.

### Worker 2A: sync-customers + sync-customer-snapshots
**Scope**: Test the customer data pipeline

**Files to create**:
- `src/lib/sync/__tests__/sync-customers.test.ts`
- `src/lib/sync/__tests__/sync-customer-snapshots.test.ts`

**Spec for sync-customers**:
- Given Frisbii customers + ClickUp data + HubSpot companies
- Maps and matches across systems (3-pass: CVR → name → unmatched)
- Upserts to `customers` table
- Does NOT overwrite manual overrides when inference returns "Unknown"
- Sets correct status (active/expired/cancelled/churned)
- Assigns match_confidence correctly
- Handles edge cases: customer with no subscription, duplicate CVR, unicode names

**Spec for sync-customer-snapshots**:
- Given customers + subscriptions + plans for a month
- Creates per-customer MRR snapshot
- `wasActiveDuringMonth()` correctly handles: active all month, started mid-month, cancelled mid-month, never active
- Normalizes MRR correctly (monthly/quarterly/annual plans)
- Includes add-on totals in MRR
- Batch upserts in chunks of 100
- Handles empty customer list gracefully

**Mocks needed**: Supabase admin client, Frisbii API, ClickUp API, HubSpot API

---

### Worker 2B: sync-frisbii (monthly snapshot aggregation)
**Scope**: Test the core MRR aggregation that produces monthly_snapshots

**File to create**:
- `src/lib/sync/__tests__/sync-frisbii.test.ts`

**Spec**:
- Given current + previous month customer_snapshots
- Correctly decomposes MRR: new, expansion, contraction, churned
- Calculates NRR, GRR, Quick Ratio, Logo Retention
- Calculates MoM and YoY growth
- Calculates top-10 concentration
- Preserves manually-edited commentary fields (executive_summary, highlights, etc.)
- Respects month locking (skips if locked)
- Handles first month (no previous data) gracefully
- Handles zero MRR edge case (division by zero in retention calcs)

**Mocks needed**: Supabase admin client (customer_snapshots query, monthly_snapshots upsert)

---

### Worker 2C: sync-pipeline + sync-channel-metrics
**Scope**: Test HubSpot pipeline sync and channel attribution

**Files to create**:
- `src/lib/sync/__tests__/sync-pipeline.test.ts`
- `src/lib/sync/__tests__/sync-channel-metrics.test.ts`

**Spec for sync-pipeline**:
- Given HubSpot deals + pipeline stages
- Filters deals by close date for the target month
- Calculates weighted pipeline (amount × probability)
- Counts won/lost/open deals correctly
- Computes win rate, avg deal size, avg sales cycle days
- Handles: no deals for month, all deals lost, stages with 0% probability

**Spec for sync-channel-metrics**:
- Given pipeline_snapshots.deals_json + customer data
- Attributes new logos and MRR to channels (outbound/partner/inbound)
- Calculates per-channel CAC, win rate, avg deal size
- Handles: deals with no channel, unknown lead source

**Mocks needed**: Supabase admin client, HubSpot API (deals, stages)

---

### Worker 2D: sync-fx + sync-discounts + sync-activities + sync-tickets
**Scope**: Test the smaller sync modules

**Files to create**:
- `src/lib/sync/__tests__/sync-fx.test.ts`
- `src/lib/sync/__tests__/sync-discounts.test.ts`
- `src/lib/sync/__tests__/sync-activities.test.ts`
- `src/lib/sync/__tests__/sync-tickets.test.ts`

**Spec for sync-fx**:
- Fetches ECB rates from Frankfurter API
- Stores DKK → EUR and DKK → USD rates for the month
- Handles: API down (graceful fallback), missing currency, weekend dates

**Spec for sync-discounts**:
- Given active subscriptions with discounts
- Snapshots each discount with monthly impact, type, expiry
- Correctly handles: percentage vs fixed discounts, no-expiry discounts, multiple discounts per subscription

**Spec for sync-activities**:
- Given HubSpot activities by owner
- Aggregates: calls_made, meetings_booked, emails_sent per owner per day
- Handles: no activities, owner with no name

**Spec for sync-tickets**:
- Given HubSpot tickets
- Counts open tickets per customer
- Handles: tickets with no customer association, closed tickets excluded

**Mocks needed**: Supabase admin client, Frankfurter API, Frisbii API, HubSpot API

---

### After Wave 2 merges:
- Update `vitest.config.ts` thresholds to **50%+ statements, 45%+ branches**
- Run `npm run test:coverage` and verify new thresholds pass

---

## Wave 3: Architecture Improvements (Day 8-10)

### Worker 3A: Shared Data Hook
**Scope**: Extract duplicated fetch/cache/error pattern from providers

**File to create**:
- `src/hooks/useDashboardData.ts`

**Spec**:
```typescript
useDashboardData<T>(endpoint: string, params?: Record<string, string>, options?: {
  refreshInterval?: number;  // default: 0 (no auto-refresh)
  enabled?: boolean;         // default: true
}): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

- Fetches from endpoint with query params
- Returns loading/error/data states
- Supports auto-refresh interval (replaces setInterval boilerplate in 3 providers)
- Supports conditional fetching (enabled flag)
- Deduplicates in-flight requests to same endpoint
- Handles unmount (cancels pending fetch)

**TDD**:
- Test: returns loading=true initially
- Test: returns data after successful fetch
- Test: returns error on fetch failure
- Test: auto-refreshes at specified interval
- Test: cancels on unmount (no state update after unmount)
- Test: skips fetch when enabled=false
- Test: deduplicates concurrent calls to same endpoint

**File to create**:
- `src/hooks/__tests__/useDashboardData.test.ts`

Note: This test will need `@testing-library/react` for hook testing. Add it as a dev dependency.

---

### Worker 3B: Refactor SalesProvider, CSProvider, DataQualityProvider
**Scope**: Simplify providers using the shared hook from 3A

**Depends on**: Worker 3A merged

**Files to modify**:
- `src/components/sales/SalesProvider.tsx`
- `src/components/cs/CSProvider.tsx`
- `src/components/data-quality/DataQualityProvider.tsx`

**Spec for each**:
- Replace internal fetch + setInterval with `useDashboardData()`
- Keep provider-specific UI state (tvMode, rotateMode, etc. for Sales)
- Reduce each provider to ~20-30 lines (from 60-90)
- All existing consuming components work without changes

**TDD**: 
- Existing component behavior must not change
- Write integration test: provider renders, passes data to consumer
- Verify auto-refresh still works (now via useDashboardData option)

---

### Worker 3C: Report Data Tests
**Scope**: Test the main aggregation function that powers all dashboards

**File to create**:
- `src/lib/__tests__/report-data.test.ts`

**Spec for `getReportData()`**:
- Single month: returns point-in-time metrics
- Range query: point-in-time uses end month, flow metrics summed
- Currency conversion applied correctly
- Unit economics: LTV, revenue per employee, CAC, LTV/CAC, gross margin, rule of 40
- Cohort data: groups by join month, tracks retention
- Commentary: returns human-written fields
- Edge cases: empty month, no customers, zero MRR, missing FX rates

**Mocks needed**: Supabase server client (multiple table queries)

---

## Wave 4: Feature Development (Day 11-14)

**All workers run in parallel. Each follows strict TDD.**

### Worker 4A: Scheduled Email Reports
**Scope**: Weekly/monthly email digests to stakeholders

**Spec**:
- Management users can configure email schedule (weekly Monday 8am, monthly 1st)
- Email contains: KPI summary, MRR trend, notable changes, commentary
- Uses existing `email-builder.ts` + Resend integration
- Scheduled via Vercel cron (new cron entry)
- Recipients configurable per role
- Unsubscribe link per user

**Files to create**:
- `src/app/api/cron/email-report/route.ts`
- `src/lib/__tests__/email-builder.test.ts` (test existing + new logic)
- DB migration: `email_preferences` table (user_id, schedule, enabled)

**Files to modify**:
- `vercel.json` — add cron entry
- `src/lib/email-builder.ts` — add weekly summary variant
- `src/components/settings/SettingsPage.tsx` — add email preferences section

**TDD**:
- Test email-builder produces valid HTML for each variant
- Test cron route sends emails to correct recipients
- Test unsubscribe toggles preference

---

### Worker 4B: PDF/CSV Export
**Scope**: Download reports for board meetings and data analysis

**Spec**:
- "Download PDF" button on board and investor report views
- "Export CSV" button on customer list and metrics tables
- PDF uses server-side rendering (React → HTML → PDF)
- CSV includes all visible columns with proper escaping
- Downloads are named: `verarca-{report-type}-{month}.{ext}`

**Files to create**:
- `src/app/api/export/pdf/route.ts`
- `src/app/api/export/csv/route.ts`
- `src/lib/export.ts` — PDF/CSV generation logic
- `src/lib/__tests__/export.test.ts`
- `src/components/ui/ExportButton.tsx`

**Dependencies to add**: None for CSV (native). For PDF: evaluate `@react-pdf/renderer` vs server-side puppeteer vs Vercel OG-style approach.

**TDD**:
- Test CSV output: correct headers, escaped values, proper encoding
- Test PDF generation: produces valid PDF buffer
- Test export endpoint: returns correct content-type and filename headers

---

### Worker 4C: Audit Log
**Scope**: Track who changed what override, when

**Spec**:
- Every manual override (customer tier, scope, segment, commentary, settings) is logged
- Log entries: user_email, timestamp, table, field, old_value, new_value, entity_id
- Viewable by management role on a new `/audit` page or within settings
- Retained for 12 months

**Files to create**:
- DB migration: `audit_log` table
- `src/lib/audit.ts` — `logChange(userId, table, field, oldVal, newVal, entityId)`
- `src/lib/__tests__/audit.test.ts`
- `src/app/(dashboard)/audit/page.tsx` (optional — could be part of settings)
- `src/components/audit/AuditLog.tsx`

**Files to modify**:
- `src/app/api/customers/[id]/route.ts` — log override changes
- `src/app/api/settings/route.ts` — log settings changes
- `src/app/api/commentary/route.ts` — log commentary edits

**TDD**:
- Test `logChange()` inserts correct record
- Test API routes call logChange on mutation
- Test audit log query returns entries in reverse chronological order
- Test entries older than 12 months are excluded from query

---

### Worker 4D: Threshold Alerts
**Scope**: Alert when key metrics cross danger thresholds

**Spec**:
- Configurable thresholds per metric (e.g., "alert if MRR drops > 5% MoM")
- Default thresholds for: MRR drop, churn spike, NRR below 100%, concentration above 30%
- Alerts shown as banner on dashboard + optional email
- Alert history viewable
- Snooze/dismiss per alert

**Files to create**:
- DB migration: `alert_rules` table, `alert_history` table
- `src/lib/alerts.ts` — `evaluateAlerts(snapshot)` → triggered alerts
- `src/lib/__tests__/alerts.test.ts`
- `src/components/ui/AlertBanner.tsx`
- `src/app/api/alerts/route.ts` — GET (list), POST (create rule), PUT (snooze)

**Files to modify**:
- `src/lib/sync/sync-frisbii.ts` — call `evaluateAlerts()` after snapshot upsert
- `src/components/report/ReportShell.tsx` — render AlertBanner

**TDD**:
- Test: MRR drop of 6% triggers alert when threshold is 5%
- Test: MRR drop of 4% does NOT trigger alert
- Test: snoozed alert is not shown
- Test: alert with email enabled sends notification
- Test: default thresholds are created on first run
- Test: custom threshold overrides default

---

## Merge & Verification Strategy

After each wave:
1. All workers merge to a shared `feature/wave-N` branch
2. Run full suite: `npx tsc --noEmit && npm test && npm run build`
3. Deploy to Vercel preview for manual smoke test
4. Merge to `main` only after preview verification

After Wave 2: Update coverage thresholds to 50%+
After Wave 4: Update coverage thresholds to 60%+

---

## Worker Assignment Summary

| Wave | Worker | Task | Parallel? | Depends On |
|------|--------|------|-----------|------------|
| 1 | A | Dead code removal | Yes | — |
| 1 | B | Error boundaries | Yes | — |
| 1 | C | TDD infrastructure | Yes | — |
| 1 | D | API route manifest test | Yes | — |
| 2 | A | sync-customers tests | Yes | Wave 1C |
| 2 | B | sync-frisbii tests | Yes | Wave 1C |
| 2 | C | sync-pipeline tests | Yes | Wave 1C |
| 2 | D | sync-fx/discounts/activities/tickets tests | Yes | Wave 1C |
| 3 | A | Shared data hook | Yes | — |
| 3 | B | Provider refactoring | No | Wave 3A |
| 3 | C | report-data tests | Yes | Wave 1C |
| 4 | A | Scheduled email reports | Yes | Wave 3 |
| 4 | B | PDF/CSV export | Yes | Wave 3 |
| 4 | C | Audit log | Yes | Wave 3 |
| 4 | D | Threshold alerts | Yes | Wave 3 |

**Total parallel workers**: Up to 4 concurrent per wave
**Total tasks**: 16
**Total new test files**: ~15
**Expected coverage after completion**: 60%+
