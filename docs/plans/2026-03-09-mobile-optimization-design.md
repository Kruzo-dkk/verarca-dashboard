# Mobile Optimization — CSS-Only Pass

**Date:** 2026-03-09
**Approach:** Surgical Tailwind class adjustments across existing components — no new components, no structural changes.
**Target:** Phone-first (375–430px), full feature depth. Every page stays fully usable on mobile.

---

## 1. Metric Cards & Spacing

**Files:** `HeroKPIs.tsx`, `RevenueSection.tsx`, `globals.css`

| Property | Current | Mobile (< sm) | Rationale |
|----------|---------|---------------|-----------|
| Card padding | `p-6` | `p-3 sm:p-6` | Halves wasted space |
| Grid gap | `gap-4` | `gap-2.5 sm:gap-4` | Tighter grid, more above fold |
| Value text | `text-2xl` | `text-xl sm:text-2xl` | Prevents overflow on narrow cards |
| Label tracking | `tracking-wider` | `tracking-wide sm:tracking-wider` | Reduces label wrapping |
| Sparkline height | 32px | 24px on mobile | Proportional to smaller card |
| Revenue committed MRR gap | `gap-6` | `gap-3 sm:gap-6` | Proportional spacing |

## 2. Bottom Navigation

**File:** `BottomNav.tsx`

| Property | Current | Mobile |
|----------|---------|--------|
| Height | `h-14` (56px) | `h-16` (64px) |
| Icons | `w-5 h-5` | `w-6 h-6` |
| Labels | `text-[10px]` | `text-[11px]` |
| Safe area | None | `pb-[env(safe-area-inset-bottom)]` |
| Content bottom pad | `pb-20` | `pb-24` |

## 3. Header & Period Selector

**Files:** `AppShell.tsx`, `PeriodSelector.tsx`

| Property | Current | Mobile |
|----------|---------|--------|
| Brand text | Full size | Smaller on xs screens |
| Dropdown width | `w-64` | `w-[calc(100vw-2rem)]` max |
| Dropdown position | `right-0` | Centered on mobile |

## 4. Tooltips

**File:** `MetricTooltip.tsx`

| Property | Current | Mobile |
|----------|---------|--------|
| Width | `w-72` fixed | `w-[calc(100vw-2rem)] sm:w-72` |
| Info dot | `w-2.5 h-2.5` | `w-3.5 h-3.5` |
| Source text | `text-[10px]` | `text-[11px]` |

## 5. Charts

**Files:** All chart components + new `useIsMobile` hook

| Property | Current | Mobile |
|----------|---------|--------|
| Height | 280–320px fixed | 220px on mobile |
| Margins | 10px all sides | 5px top/right, 0 left |
| Axis font | 12px | 10px |
| Ticks | preserveStartEnd | Fewer ticks on mobile |

**Implementation:** `useIsMobile()` hook using `window.matchMedia('(max-width: 639px)')`.

## 6. Tables & Data Pages

**Files:** `CustomerList.tsx`, `PipelineSection.tsx`, `SettingsPage.tsx`, `ForecastPage.tsx`

| Property | Current | Mobile |
|----------|---------|--------|
| Cell padding | `px-3 py-2` | `px-2 py-1.5` |
| Font size | `text-sm` | `text-xs` on mobile |
| Column hiding | Partial | Expand `hidden sm:table-cell` |
| Scroll hint | None | Right-edge fade gradient |
| Touch targets | Default | `min-h-[44px]` on inputs/buttons |

---

## Implementation Order

1. `useIsMobile` hook (needed by charts)
2. `globals.css` — responsive `.glass-card` padding
3. `BottomNav.tsx` — safe area + larger targets
4. `AppShell.tsx` — content padding adjustment
5. `HeroKPIs.tsx` — responsive cards
6. `MetricTooltip.tsx` — fluid width
7. `PeriodSelector.tsx` — mobile dropdown
8. Chart components — responsive heights/fonts
9. `RevenueSection.tsx` — committed MRR spacing
10. `CustomerList.tsx` — table density
11. `PipelineSection.tsx` — table density
12. `SettingsPage.tsx` — touch targets
13. `ForecastPage.tsx` — touch targets + chart
