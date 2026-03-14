# UI Restructuring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure navigation from 7 flat items to 5 grouped items + user menu, merge report pages, rename settings, add mobile bottom sheet, and sign-out.

**Architecture:** Purely frontend changes — no API or DB modifications. Existing page components (BoardReport, InvestorDashboard, SettingsPage) stay as-is. New tabbed Reports page composes the existing components. User menu adds sign-out (currently missing). Mobile bottom sheet replaces truncated bottom nav.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Supabase Auth (signOut)

---

### Task 1: Update route access matrix and default routes

**Files:**
- Modify: `src/lib/auth/roles.ts`

**Step 1: Update ROUTE_ACCESS and getDefaultRoute**

Replace the dashboard page rules and default route function:

```typescript
// Dashboard pages — replace these 4 rules:
//   { prefix: "/settings", ... }
//   { prefix: "/board-report", ... }
//   { prefix: "/investor", ... }
// With:
  { prefix: "/monthly-input", roles: ["management"] },
  { prefix: "/reports", roles: ["management", "board", "investor"] },

// In getDefaultRoute, change:
//   case "board": return "/board-report";
//   case "investor": return "/investor";
// To:
//   case "board": return "/reports";
//   case "investor": return "/reports";
```

**Step 2: Update tests**

In `src/lib/__tests__/roles.test.ts`, update all route references:
- `/board-report` → `/reports`
- `/investor` → `/reports`
- `/settings` → `/monthly-input`
- Board and investor default routes → `/reports`
- Board can access `/reports` (true)
- Investor can access `/reports` (true)
- Both board/investor cannot access `/monthly-input`

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/lib/auth/roles.ts src/lib/__tests__/roles.test.ts
git commit -m "refactor: update route matrix for reports and monthly-input"
```

---

### Task 2: Move page routes

**Files:**
- Create: `src/app/(dashboard)/reports/page.tsx`
- Create: `src/app/(dashboard)/monthly-input/page.tsx`
- Delete: `src/app/(dashboard)/board-report/page.tsx`
- Delete: `src/app/(dashboard)/investor/page.tsx`
- Delete: `src/app/(dashboard)/settings/page.tsx`

**Step 1: Create tabbed Reports page**

```tsx
// src/app/(dashboard)/reports/page.tsx
"use client";

import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { BoardReport } from "@/components/board/BoardReport";
import { InvestorDashboard } from "@/components/investor/InvestorDashboard";

type ReportTab = "board" | "investor";

export default function ReportsPage() {
  const { role } = useUserRole();

  // Board/investor roles see only their view — no tabs
  if (role === "board") return <BoardReport />;
  if (role === "investor") return <InvestorDashboard />;

  // Management sees tab toggle
  return <ReportsWithTabs />;
}

function ReportsWithTabs() {
  const [tab, setTab] = useState<ReportTab>("board");

  return (
    <div>
      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--bg-surface)] p-1 w-fit">
        <TabButton active={tab === "board"} onClick={() => setTab("board")}>
          Board Report
        </TabButton>
        <TabButton active={tab === "investor"} onClick={() => setTab("investor")}>
          Investor View
        </TabButton>
      </div>

      {tab === "board" ? <BoardReport /> : <InvestorDashboard />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}
```

**Step 2: Create monthly-input page**

```tsx
// src/app/(dashboard)/monthly-input/page.tsx
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function MonthlyInputPage() {
  return <SettingsPage />;
}
```

**Step 3: Delete old page files**

```bash
rm src/app/\(dashboard\)/board-report/page.tsx
rm src/app/\(dashboard\)/investor/page.tsx
rm src/app/\(dashboard\)/settings/page.tsx
rmdir src/app/\(dashboard\)/board-report
rmdir src/app/\(dashboard\)/investor
rmdir src/app/\(dashboard\)/settings
```

**Step 4: Verify build**

Run: `npx next build`
Expected: Build succeeds, `/reports` and `/monthly-input` routes appear

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: merge reports pages, move settings to monthly-input"
```

---

### Task 3: Extend useUserRole to include user email and display name

**Files:**
- Modify: `src/hooks/useUserRole.ts`

**Step 1: Add email and displayName to the hook**

The hook currently returns `{ role, loading }`. Extend it to also return user email and display name (needed for the user menu). Fetch from Supabase auth user + user_profiles.

```typescript
interface UseUserRoleResult {
  role: UserRole | null;
  email: string | null;
  displayName: string | null;
  loading: boolean;
}

// Cache all three values
let cachedRole: UserRole | null = null;
let cachedEmail: string | null = null;
let cachedDisplayName: string | null = null;

// In fetchRole(), after getting user and profile:
//   cachedEmail = user.email ?? null;
//   cachedDisplayName = data.display_name ?? null;
// Return all four values from the hook.
```

**Step 2: Commit**

```bash
git add src/hooks/useUserRole.ts
git commit -m "feat: extend useUserRole to include email and displayName"
```

---

### Task 4: Add new nav icons

**Files:**
- Modify: `src/components/nav/NavIcons.tsx`

**Step 1: Add ReportsIcon, MoreIcon, MonthlyInputIcon, SignOutIcon, ChevronLeftIcon, ChevronRightIcon**

ReportsIcon: clipboard with chart (combines board report + investor concepts).
MoreIcon: three horizontal dots (⋯).
MonthlyInputIcon: calendar with pen/edit indicator.
SignOutIcon: door with arrow.
ChevronLeftIcon/ChevronRightIcon: for the mobile period bar.

Follow existing pattern: 20×20 viewBox, stroke-based, `currentColor`, strokeWidth 1.5.

**Step 2: Commit**

```bash
git add src/components/nav/NavIcons.tsx
git commit -m "feat: add ReportsIcon, MoreIcon, and utility nav icons"
```

---

### Task 5: Add user menu component

**Files:**
- Create: `src/components/nav/UserMenu.tsx`

**Step 1: Create the UserMenu component**

Renders a circle with user initials (from displayName or email). On click, toggles a dropdown with:
- User name/email display
- Role badge (colored pill: management=coral, board=teal, investor=emerald)
- "Manage Users" link (management role only) → `/users`
- Sign Out button (calls `supabase.auth.signOut()` then `router.push("/login")`)

Close on outside click and Escape (same pattern as PeriodSelector).

**Step 2: Commit**

```bash
git add src/components/nav/UserMenu.tsx
git commit -m "feat: add UserMenu component with sign-out"
```

---

### Task 6: Add bottom sheet component

**Files:**
- Create: `src/components/nav/BottomSheet.tsx`

**Step 1: Create the BottomSheet component**

Props: `open: boolean`, `onClose: () => void`, `children: ReactNode`.

Renders:
- Backdrop overlay (semi-transparent, click to close)
- Slide-up panel from bottom with rounded top corners
- Drag handle bar at top (decorative)
- Content area with children
- Animate: translate-y transition (CSS only, no spring library needed)
- Close on Escape key

**Step 2: Commit**

```bash
git add src/components/nav/BottomSheet.tsx
git commit -m "feat: add BottomSheet component for mobile overflow nav"
```

---

### Task 7: Restructure AppShell navigation

**Files:**
- Modify: `src/components/nav/AppShell.tsx`

**Step 1: Update nav items list**

Replace `allNavItems` with new structure:
- Dashboard, Customers, Forecast, Reports, Monthly Input
- Remove: Board Report, Investor, Settings, Users (Users goes to user menu)
- Add `mobileOnly` and `mobileHidden` flags to control which items appear in bottom nav vs desktop

Desktop shows all 5. Mobile bottom nav shows: Dashboard, Customers, Reports, More.
"More" opens bottom sheet with: Forecast, Monthly Input + user section.

**Step 2: Add UserMenu to header**

Replace the refresh button area with: refresh button + UserMenu component.

**Step 3: Add mobile period bar**

Below the header, add a `lg:hidden` sticky bar with prev/next arrows and current month label. Wire to `setPeriod` from ReportProvider context.

**Step 4: Update BottomNav integration**

Pass separate `bottomNavItems` (Dashboard, Customers, Reports) + overflow items to BottomNav. Add More button that opens BottomSheet with overflow items.

**Step 5: Verify build**

Run: `npx next build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/components/nav/AppShell.tsx
git commit -m "refactor: restructure AppShell with grouped nav and user menu"
```

---

### Task 8: Restructure BottomNav with More button

**Files:**
- Modify: `src/components/nav/BottomNav.tsx`

**Step 1: Replace truncation with More button**

Remove `items.slice(0, 5)` logic. Accept two props:
- `items`: primary items to show as icons (Dashboard, Customers, Reports)
- `overflowItems`: items for the More sheet (Forecast, Monthly Input)
- `userEmail`, `userDisplayName`, `userRole`: for the user section in the sheet

Add a 4th button: More (⋯ icon) that opens a BottomSheet containing:
- Overflow nav links
- Divider
- User info + Sign Out

**Step 2: Commit**

```bash
git add src/components/nav/BottomNav.tsx
git commit -m "refactor: BottomNav with More sheet instead of truncation"
```

---

### Task 9: Add welcome header for board/investor roles

**Files:**
- Modify: `src/components/board/BoardReport.tsx`
- Modify: `src/components/investor/InvestorDashboard.tsx`

**Step 1: Add welcome context for limited roles**

At the top of each component, when the user's role is not management, show:
- "Welcome, [name]" line
- "Data as of [last refresh date]" indicator
- Role badge

This is a small UI-only addition to the existing components. Use `useUserRole()` hook.

**Step 2: Commit**

```bash
git add src/components/board/BoardReport.tsx src/components/investor/InvestorDashboard.tsx
git commit -m "feat: add welcome header for board and investor roles"
```

---

### Task 10: Update tests and final verification

**Files:**
- Modify: `src/lib/__tests__/roles.test.ts` (already done in Task 1)

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run build**

Run: `npx next build`
Expected: Clean build, new routes present

**Step 3: Final commit and deploy**

```bash
git push origin main
```

Vercel auto-deploys from main.
