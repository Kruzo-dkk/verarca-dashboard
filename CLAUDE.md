# Verarca Dashboard

## Stack
- Next.js App Router, TypeScript, Tailwind CSS, Supabase (Postgres + Auth)
- Frisbii (Reepay) for billing/subscriptions, HubSpot for CRM/pipeline
- Vercel auto-deploys on push to main; daily cron at 06:00 UTC runs /api/cron/snapshot

## Build & Check
- `npx tsc --noEmit` — type check (run before committing)
- `npm run build` — production build (must pass before pushing)
- No test suite currently

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
