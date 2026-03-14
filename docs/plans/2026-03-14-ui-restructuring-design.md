# UI Restructuring Design

**Date:** 2026-03-14
**Status:** Approved

## Problem

Navigation grew to 7 flat top-level items for management role. Mobile bottom nav silently truncates at 5 (Settings + Users unreachable). No user identity visible. "Settings" is a misleading name for monthly data entry.

## Design

### 1. Navigation: 7 items → 5 + user menu

**Desktop tabs:** Dashboard · Customers · Forecast · Reports · Monthly Input
**Mobile bottom nav:** Dashboard · Customers · Reports · More (⋯)
**User menu (avatar, top-right):** Name + role badge, Users link (management), Sign Out

### 2. Tabbed Reports page (`/reports`)

Replaces separate `/board-report` and `/investor` routes.

- Management sees tab toggle: Board | Investor
- Board role lands directly on Board tab (no toggle shown)
- Investor role lands directly on Investor tab (no toggle shown)
- No redirect routes needed (no existing users)

### 3. Rename Settings → Monthly Input (`/monthly-input`)

Same SettingsPage component, route and label change only. Delete old `/settings` route.

### 4. Mobile "More" bottom sheet

Bottom sheet triggered by ⋯ icon in bottom nav. Contains:
- Overflow nav items (Forecast, Monthly Input)
- User info + Sign Out

### 5. Mobile period bar

Sticky bar below header on mobile (< lg): `← February 2025 →`
Always visible. Simple prev/next month navigation.

### 6. Board/Investor welcome header

For limited-access roles: welcome line with role context and data freshness indicator.

### Route changes (no redirects — clean moves)

| Old | New |
|-----|-----|
| `/settings` | `/monthly-input` |
| `/board-report` | `/reports` |
| `/investor` | `/reports` |
| `/users` | `/users` (stays, removed from main nav) |

### Files to modify

- `src/components/nav/AppShell.tsx` — nav items, user menu, mobile period bar
- `src/components/nav/BottomNav.tsx` — 4 items + More sheet
- `src/components/nav/NavIcons.tsx` — add MoreIcon, ReportsIcon
- `src/app/(dashboard)/reports/page.tsx` — new tabbed reports page
- `src/app/(dashboard)/monthly-input/page.tsx` — moved from settings
- `src/lib/auth/roles.ts` — update route access matrix
- `src/middleware.ts` — update route references
- Delete: `src/app/(dashboard)/board-report/`, `src/app/(dashboard)/investor/`, `src/app/(dashboard)/settings/`

### What stays the same

- All design tokens, colors, typography, glass cards
- All page components (BoardReport, InvestorDashboard, SettingsPage, UserManagement)
- RBAC middleware pattern and role definitions
- API routes unchanged
