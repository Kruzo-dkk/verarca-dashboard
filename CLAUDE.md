# Verarca Dashboard

## Stack
- Next.js App Router, TypeScript, Tailwind CSS, Supabase (Postgres + Auth)
- Frisbii (Reepay) for billing/subscriptions, HubSpot for CRM/pipeline
- Vercel auto-deploys on push to main. Crons (vercel.json): /api/cron/snapshot + /api/cron/sync-activities every 15 min (incremental sync of the current month); /api/cron/backfill?through=current daily 03:17 UTC (full rebuild of every month, self-healing safety net); /api/cron/send-digest monthly (1st, 07:00 UTC)

## Build & Test
- `npx tsc --noEmit` — type check (run before committing)
- `npm test` — run all tests (Vitest)
- `npm run test:watch` — run tests in watch mode during development
- `npm run test:coverage` — run tests with coverage report (thresholds enforced)
- `npm run build` — production build (must pass before pushing)
- Vercel build command runs `npm test && next build` — tests must pass to deploy

## TDD Workflow
All new features follow test-driven development:
1. Write failing test describing expected behavior
2. Implement minimal code to pass the test
3. Refactor — tests must still pass

### Test locations
- `src/lib/__tests__/` — pure function tests (metrics, currency, period, format-plan-name, etc.)
- `src/lib/sync/__tests__/` — sync module tests (with mocked Supabase/Frisbii)

### Test utilities (`src/test/`)
- `setup.ts` — global afterEach mock cleanup
- `mocks/supabase.ts` — `createMockSupabaseClient()`, `mockAdminModule()`, `resetChain()`
- `mocks/frisbii.ts` — `buildSubscription()`, `buildInvoice()`, `buildPlan()`, `buildCustomer()`
- `mocks/hubspot.ts` — `buildHubSpotDeal()`, `buildPipelineStage()`

### What to test
- Calculation/formatting functions (metrics, currency, period, health-score, forecast)
- Data transformation and parsing (format-plan-name, committed-mrr)
- Sync validation logic (validate-sync)
- RBAC rules (roles.ts)
- Benchmark data integrity

### What NOT to test (for now)
- React components (no testing-library installed yet)
- API route handlers directly (test the logic they call instead)
- Supabase queries (test the business logic that uses query results)

## Key Conventions
- All monetary values stored in DKK øre (integer minor units). Divide by 100 for display.
- Plan display names are parsed from Frisbii handles at display layer (`src/lib/format-plan-name.ts`), not stored
- Scope/tier/segment: inferred from plan handle, with `_override` DB columns for manual corrections
- Sync upserts must not clobber manual overrides — strip fields from payload when inference returns "Unknown"
- Danish accounting classes (Regnskabsklasser): A, B (Mikro), B, C (Mellem), C (Stor), D
- HubSpot EU region: base URL is `api-eu1.hubapi.com`

## Architecture
- `src/lib/sync/` — data sync modules (Frisbii, HubSpot, FX). Orchestrated by `sync-monthly.ts`
- `src/lib/report-data.ts` — main aggregation for dashboard data
- `src/components/providers/ReportProvider.tsx` — global state (month, currency, data)
- `src/components/sales/SalesProvider.tsx` — sales dashboard state (separate from ReportProvider)
- RBAC: management/board/investor roles. Route matrix in `src/lib/auth/roles.ts`
- Unified dashboard at `/` with role-based tabs. Sales dashboard at `/sales` with TV mode (`?tv=true`)

## Supabase
- Local types: `src/lib/supabase/database.types.ts` — update manually after migrations
- Admin client (bypasses RLS): `src/lib/supabase/admin.ts`
- Server client (respects RLS): `src/lib/supabase/server.ts`

## Gotchas
- Supabase generated types use `string | null` but TS widens to `undefined` on optional access — accept `| undefined` in function signatures
- Tailwind responsive classes (`hidden sm:table-column`) don't work on `<col>` elements — use inline `style={{ width }}`
- Frisbii API: plan `name` field equals `handle` — no human-readable names available
- `sync-customers.ts` upserts with `onConflict: "frisbii_handle"` — will overwrite all fields including manual corrections unless handled
