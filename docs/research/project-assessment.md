# Verarca Project Assessment

**Date**: 2026-04-15
**Scope**: Full codebase audit — architecture, business logic, UI, test coverage, structural organization
**Goal**: Assess readiness as a world-class dashboard and reporting tool for running the Verarca business

---

## Executive Summary

Verarca is a **solid, well-built SaaS metrics dashboard** with strong business logic, clean architecture in the data layer, and a thoughtful design system. The sync pipeline, metric calculations, and RBAC are production-grade.

However, it has **structural sprawl** in the API layer, **gaps in feature completeness** for a world-class tool, and **organizational inconsistencies** that will compound as it grows. The project reads like it was built feature-by-feature (which is normal) but hasn't been through a holistic structural pass.

**Overall score: 7/10** — strong foundation, needs tightening and feature depth.

---

## What's Working Well

### 1. Business Logic (9/10)
The calculation engine is the crown jewel:
- MRR decomposition (new, expansion, contraction, churned) is textbook-correct
- Retention metrics (NRR, GRR, Quick Ratio, Logo Retention) properly implemented
- Health scoring with weighted factors (MRR trend, activity, tenure, tickets, tier)
- Committed MRR with discount expiration tracking
- Forecast engine with scenario modeling
- All monetary values in DKK ore (integer minor units) — no floating-point issues
- 10 well-tested pure-function modules with proper edge case coverage

### 2. Sync Pipeline (8/10)
`src/lib/sync/` is well-orchestrated:
- `sync-monthly.ts` runs 10 modules in dependency order (parallel where possible)
- Idempotency guard (10-min skip window)
- Month locking to prevent overwriting manual edits
- 3-pass HubSpot matching (CVR → name → unmatched) with confidence scoring
- Override protection (strip inferred fields when "Unknown")

### 3. Design System (8/10)
- Cohesive CSS variable system (coral accent, teal, emerald)
- Glass-morphism card pattern used consistently
- Three professional fonts (DM Sans, DM Serif Display, IBM Plex Mono)
- Status badge system (pass/warn/fail/no_data)
- Print styles and TV mode dark theme
- Mobile-first responsive approach

### 4. RBAC (8/10)
- Three clear roles (management, board, investor)
- Centralized route matrix in `roles.ts`
- Middleware enforcement + API-level checks
- Role-filtered navigation

### 5. Tech Stack (9/10)
Exceptionally lean — 7 production dependencies:
- Next.js 16.1.6, React 19, Supabase, Recharts, Resend
- No unnecessary abstractions, state libraries, or framework bloat
- Latest stable versions across the board

---

## What Needs Work

### Problem 1: API Route Sprawl (Structure)

**28 API routes** with significant overlap and inconsistency:

```
/api/report           — main aggregation
/api/revenue          — revenue subset (redundant?)
/api/metrics          — metrics subset (redundant?)
/api/churn            — churn subset (redundant?)
/api/subscriptions    — subscription data (redundant?)
/api/cs               — customer success
/api/pipeline         — pipeline data
/api/sales            — sales data
/api/sales/targets    — sales targets
/api/forecast         — forecast
/api/customers        — CRUD
/api/customers/[id]   — single customer
/api/users            — CRUD
/api/users/[id]       — single user
/api/settings         — settings
/api/commentary       — commentary
/api/data-quality     — data quality
/api/data-quality/exclusions — exclusions
/api/fx               — FX rates
/api/report/board     — board report
/api/report/investor  — investor report
/api/report/email     — email generation
/api/cron/snapshot    — main cron
/api/cron/sync-activities — activity sync
/api/cron/backfill    — backfill
/api/cron/backfill-hubspot
/api/cron/backfill-pipeline
/api/cron/backfill-plan-names
```

**Issues:**
- `/api/revenue`, `/api/metrics`, `/api/churn`, `/api/subscriptions` appear to serve subsets of what `/api/report` already provides — likely legacy routes that were never cleaned up
- 4 backfill routes are one-time-use utilities mixed in with production routes
- Role checks are duplicated in each handler rather than centralized
- No API versioning strategy

**Recommendation:** Consolidate to ~12 routes:
- `/api/report` (main aggregation, with query params for board/investor variants)
- `/api/sales` + `/api/sales/targets`
- `/api/cs`
- `/api/forecast`
- `/api/customers` + `/api/customers/[id]`
- `/api/users` + `/api/users/[id]`
- `/api/settings`
- `/api/data-quality` + `/api/data-quality/exclusions`
- `/api/cron/snapshot` + `/api/cron/sync-activities`
- Remove or move backfill routes to scripts/

---

### Problem 2: Root-Level Component Orphans (Structure)

Four components sit directly in `src/components/` outside any subdirectory:

```
src/components/
  KPICard.tsx           ← should be in ui/
  RevenueChart.tsx      ← should be in charts/
  ChurnChart.tsx        ← should be in charts/
  SubscriptionTable.tsx ← should be in report/ or customers/
```

These are likely the oldest components, created before the directory structure was established. They should be relocated to match the pattern used by everything else.

---

### Problem 3: Provider Proliferation (Architecture)

Five separate providers with similar patterns:
- `ReportProvider` — global dashboard state
- `SalesProvider` — sales dashboard
- `CSProvider` — customer success dashboard
- `DataQualityProvider` — data quality dashboard
- (implicit forecast state in ForecastPage)

Each independently fetches data, manages loading/error states, and provides context. This creates:
- Duplicated fetch/error/loading boilerplate
- No shared data between views (e.g., customer data fetched separately in Report vs CS vs Sales)
- Each provider re-implements the same patterns

**Recommendation:** Extract a shared `useDashboardData(endpoint, params)` hook that handles fetch, cache, loading, and error. Keep domain-specific contexts thin — they should hold UI state (selected filters, view mode) and delegate data fetching to the shared hook.

---

### Problem 4: Type Organization (Structure)

Types are split across two locations with no clear rule:

```
src/lib/types/          — 7 domain type files (report.ts, sales.ts, cs.ts, etc.)
src/lib/supabase/database.types.ts — auto-generated DB types
```

But many components and lib files define inline types or import from both locations. The `types/` directory mixes:
- API response shapes
- Database row types
- UI component props
- Business domain entities

**Recommendation:** Establish a clear convention:
- `src/lib/types/` → business domain types only (entities, metrics, calculations)
- Database types stay in `supabase/database.types.ts`
- Component prop types stay colocated with their components
- API response types colocated with their route handlers

---

### Problem 5: Test Coverage Baseline (Quality)

Coverage thresholds are set at **17-20%** — essentially a formality:

```
// vitest.config.ts thresholds
statements: ~20%
branches: ~17%
functions: ~20%
lines: ~20%
```

**What's tested (well):**
- 10 pure-function test suites in `src/lib/__tests__/`
- 1 sync validation test in `src/lib/sync/__tests__/`
- Good mock infrastructure (Supabase, Frisbii, HubSpot builders)

**What's not tested:**
- Zero sync module tests (sync-customers, sync-frisbii, sync-pipeline, etc.)
- Zero API route tests
- Zero component tests (no testing-library installed)
- The sync pipeline is the most critical code path and has no test coverage

**Recommendation:** Priority order:
1. Test sync modules (highest business risk — bad sync = bad data = wrong decisions)
2. Raise thresholds to 60%+ as sync tests land
3. API route integration tests (at least happy path)
4. Component tests can wait until testing-library is justified

---

### Problem 6: Missing Features for "World-Class" (Completeness)

**Present but basic:**
- Charts (Recharts — functional but not distinctive)
- KPI cards
- Period selection
- Currency toggle
- Role-based views
- TV mode for sales

**Conspicuously absent for a business-critical tool:**

| Feature | Impact | Effort |
|---------|--------|--------|
| **Alerts/notifications** — threshold-based alerts (MRR drops >5%, churn spikes) | High | Medium |
| **Scheduled email reports** — weekly/monthly digests to stakeholders | High | Low (Resend already integrated) |
| **PDF/CSV export** — download reports for board meetings | High | Medium |
| **Drill-down navigation** — click a KPI to see underlying data | High | Medium |
| **Audit log** — who changed what override, when | Medium | Low |
| **Dashboard annotations** — mark events on charts (product launches, price changes) | Medium | Medium |
| **Goal tracking** — set targets per metric, show progress | Medium | Low (sales targets exist, but not for other metrics) |
| **Trend indicators on all KPIs** — MoM/QoQ arrows everywhere | Medium | Low |
| **Real-time refresh** — auto-poll or Supabase realtime subscriptions | Medium | Low |
| **Saved views/filters** — per-user filter presets | Low | Medium |
| **Dark mode** — full app (TV mode proves the pattern works) | Low | Low |
| **Onboarding/empty states** — first-time user experience | Low | Low |

---

### Problem 7: Dead/Unused Code (Hygiene)

Flagged during exploration:
- `src/lib/report-data.ts` — appears to have 0 exports (dead code or unused module)
- `src/lib/email-builder.ts` — 0 exports
- `/api/revenue`, `/api/metrics`, `/api/churn`, `/api/subscriptions` — likely superseded by `/api/report`
- 4 backfill cron routes — one-time scripts that should live in `scripts/` not production API

---

### Problem 8: No Error Boundaries (Resilience)

Components handle errors via conditional rendering (`if (error) return <div>...`), but there are no React Error Boundaries. A single unhandled exception in any chart component crashes the entire dashboard.

**Recommendation:** Add error boundaries at:
- Dashboard layout level (catch-all)
- Per-section level (one broken chart shouldn't kill the whole page)

---

## Structural Reorganization Proposal

Current structure is 80% good. Here's what a clean pass would look like:

```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # unified dashboard
│   │   ├── customers/
│   │   ├── forecast/
│   │   ├── data-quality/
│   │   ├── monthly-input/
│   │   └── users/
│   ├── api/
│   │   ├── report/               # consolidated: main, board, investor, email
│   │   ├── sales/                # sales + targets
│   │   ├── cs/
│   │   ├── forecast/
│   │   ├── customers/            # CRUD
│   │   ├── users/                # CRUD
│   │   ├── settings/
│   │   ├── data-quality/         # + exclusions
│   │   └── cron/                 # snapshot + sync-activities only
│   └── auth/callback/
│
├── components/
│   ├── ui/                       # primitives (move KPICard here)
│   ├── charts/                   # all charts (move RevenueChart, ChurnChart here)
│   ├── nav/                      # navigation
│   ├── providers/                # shared data providers
│   ├── dashboard/                # rename from report/ — unified dashboard sections
│   ├── sales/
│   ├── cs/
│   ├── forecast/
│   ├── customers/                # rename from customer/
│   ├── data-quality/
│   ├── users/
│   └── email/
│
├── lib/
│   ├── calculations/             # rename/group: metrics, forecast, health-score, committed-mrr, benchmarks
│   ├── sync/                     # keep as-is (well organized)
│   ├── integrations/             # group: frisbii, hubspot, hubspot-*, clickup
│   ├── auth/                     # keep as-is
│   ├── supabase/                 # keep as-is
│   ├── types/                    # domain types only
│   └── utils/                    # group: period, currency, format-plan-name, tooltip-registry
│
├── hooks/                        # keep as-is
├── test/                         # keep as-is
└── styles/                       # globals.css (currently in app/)
```

**Key changes:**
1. Move orphan components into their proper directories
2. Group `lib/` business logic into `calculations/`, `integrations/`, `utils/`
3. Remove dead API routes; move backfill scripts out of `api/cron/`
4. Rename `report/` → `dashboard/` (it's the unified dashboard, not a report)
5. Rename `customer/` → `customers/` (match route name)

---

## Priority Roadmap

### Phase 1: Tighten (1-2 days)
- [ ] Move orphan components to correct directories
- [ ] Remove dead code (`report-data.ts` if unused, `email-builder.ts` if unused)
- [ ] Add error boundaries (layout + per-section)
- [ ] Remove or deprecate legacy API routes (`/api/revenue`, `/api/metrics`, `/api/churn`, `/api/subscriptions`)
- [ ] Move backfill routes to `scripts/`

### Phase 2: Test Critical Paths (3-5 days)
- [ ] Write sync module tests (sync-customers, sync-frisbii, sync-customer-snapshots)
- [ ] Raise coverage thresholds to 50%+
- [ ] Add at least happy-path API route tests

### Phase 3: Feature Depth (1-2 weeks)
- [ ] Scheduled email reports (Resend already integrated)
- [ ] PDF export for board reports
- [ ] Threshold-based alerts (MRR drop, churn spike)
- [ ] Drill-down from KPIs to underlying data
- [ ] Audit log for manual overrides

### Phase 4: Polish (1 week)
- [ ] Consolidate providers with shared data hook
- [ ] Group `lib/` into `calculations/`, `integrations/`, `utils/`
- [ ] Full dark mode (extend TV mode pattern)
- [ ] Dashboard annotations (mark events on charts)
- [ ] Trend indicators on all KPIs

---

## Numbers at a Glance

| Metric | Value |
|--------|-------|
| Total source files | 166 |
| Total LOC | 23,531 |
| Pages | 9 |
| API routes | 28 (recommend: ~12) |
| Components | 62 |
| Lib modules | 45 |
| Test suites | 11 |
| Test coverage | ~17-20% (target: 60%+) |
| Dependencies (prod) | 7 |
| Dependencies (dev) | 12 |
| Cron jobs | 2 (every 15 min) |
| Roles | 3 (management, board, investor) |
| External integrations | 4 (Frisbii, HubSpot, ClickUp, Frankfurter) |
