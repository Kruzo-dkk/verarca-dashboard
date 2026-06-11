# Plan: Budget power features

Six additions that turn the Budget grid from a data-entry table into a decision tool:
variance heatmap, fill/paste, runway, auto-suggested budgets, forecast reconciliation,
and month lock/close. All reuse primitives already in `budget.ts`, `/api/budget`,
the forecast engine, and the snapshot data.

Ships as **one PR per feature**, in the sequence below. Each PR is independently
deployable, tsc/test/build-green, and follows TDD (pure logic first).

---

## Design language & UX principles — the bar is *sublime*

A dense financial grid that feels **calm, instant, and trustworthy**: native-spreadsheet
muscle memory with a financial product's restraint. These are **acceptance criteria for
every PR**, not aspirations.

1. **Color is signal, never decoration.** Disciplined semantic palette — structure in
   neutral greys; periods keyed (Quarter = light blue, YTD = emerald, Year = grey,
   current month = subtle highlight); variance green/amber/red that is *meaning-aware*
   (over-budget **burn** is red, over-budget **MRR** is green) with magnitude-proportional
   opacity; brand teal `#1A5C5A` for primary actions and cross-tool consistency. Nothing
   colored unless it carries meaning.
2. **Direct manipulation, spreadsheet-grade.** Click any cell and type; full keyboard grid
   nav (arrows / Tab / Enter); fill-handle + ⌘D/⌘R; paste from Excel; ⌘Z undo on bulk
   edits. Zero modals for editing.
3. **Quiet, live feedback.** Optimistic autosave with a calm "Saved ✓" (never a blocking
   spinner); the changed cell gets a ~180ms highlight-fade; totals / runway / heatmap
   recompute live as you type. Alive, never noisy.
4. **Progressive disclosure.** Collapsible sections with a summary line when collapsed;
   Numbers ⇄ Heatmap toggle; ghost suggestions that whisper. A board member scans the
   heatmap + exceptions; finance sees editable numbers — same grid, right altitude.
5. **Motion with purpose.** Fast (150–200 ms), eased, subtle — cross-fade the heatmap,
   staggered ripple when a fill lands, height-animate collapses, fade-set on close. No
   bounce. Respect `prefers-reduced-motion`.
6. **Sticky orientation.** Sticky metric column + header; current month at the left edge
   (shipped); period boundaries always legible so you never lose your place.
7. **Typographic rhythm.** Tabular numerals, right-aligned, Danish formatting; three-tier
   hierarchy per metric — label (primary) > budget (medium) > actual & last-yr (muted).
8. **Trustworthy by construction.** Closed months *look* immutable (desaturated + 🔒);
   suggestions are visibly anchored in real actuals; variance uses a stable denominator.
9. **Accessible & consistent.** Keyboard-complete, `focus-visible` rings, status by
   icon + colour (not colour alone), AA contrast, aria labels. Reuse `GlassCard`, app
   typography, the chart theme — part of the product, not bolted on.

### The sublime layer — per-feature feel

- **#1 Heatmap & exceptions.** Magnitude-proportional tint (a 4% miss ≠ a 40% miss),
  red→amber→green by *meaning*, low-opacity so numbers stay crisp. `Numbers ⇄ Heatmap`
  segmented toggle with a cross-fade, preference persisted. Exceptions = worst-first pill
  chips with ▲/▼ + signed delta; click a chip → scroll + flash the cell. Empty = calm
  "On plan ✓". Hover legend.
- **#2 Fill & paste.** Sheets-style fill handle (drag → range-outline preview, release to
  commit) + ⌘D/⌘R. Paste → non-modal inline confirm ("Paste 12 values into Net burn ·
  Jul–Jun? ⏎ / Esc") with the target outlined. Filled cells ripple-highlight in a fast
  stagger. `Filled 12 cells · Undo (⌘Z)` toast.
- **#3 Runway.** A slim cash sparkline along the grid foot, cash-zero month marked and
  reddening as it nears; "months of runway" as one calm number, colour-graded
  (green >12 / amber 6–12 / red <6). Recomputes live as you edit burn.
- **#4 Auto-suggest.** Ghost values in empty future cells — low-contrast italic with a
  faint ✦, a whisper not clutter. Focus → the ghost becomes the editable default
  (Tab-accepts with a quick solidify-highlight); "Accept all" per section. Visibly
  anchored in trailing actuals.
- **#5 Reconcile vs Forecast.** Faint ghost rows under New-MRR for predicted/best/worst,
  colour-matched to the Forecast tool's scenario colours (mental model carries across
  tools). Divergence = a calm inline one-liner with "view in Forecast →", never an alarm.
- **#6 Lock / close.** Closing is deliberate and satisfying: confirm → the month's actuals
  desaturate and gain a small 🔒. Reforecast drift from plan-of-record shows as a subtle
  ▲/▼. Locked = solid and trusted, not greyed-out-broken.

### Reusable polish (build once in PR 1, use everywhere)

- `useCellHighlight` — the 180 ms save/change fade (shared by edit, fill, accept-suggestion).
- `<SavedIndicator>` / toast+undo primitive (shared by fill, paste, close).
- `heatScale(goodDirection, variancePct)` → opacity + hue (shared by heatmap + exceptions + reconcile).
- A focus-manager keyed by `month+metricKey+field` (no per-cell state) powering arrow-nav, fill anchors, paste landing.

---

## UI mockups

Legend: `[ 95 ]` editable input · `·` no actual yet · `░▒▓` heatmap green/amber/red ·
`●` current · `*` future · `🔒` locked · `✦` suggested ghost.

**Base grid** (design applied — quarter blue, YTD emerald, year grey, 3-tier rows):

```
┌ Budget ───────────────  Budget vs Actual · FY 1 Aug – 31 Jul ─────────────────────┐
│ View [Monthly] Q  Y       Numbers │ Heatmap      Suggest ○            Saved ✓       │
├────────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ Jun 26    ▲ Net burn +14%    ▼ New MRR 71%    ▲ S&M +9%    ▽ Gross margin −4pts    │
├───────────────────┬───────┬────────┬────────┬──────────┬───────────┬─────────┬──────┤
│ Metric            │ May26 │ Jun26● │  Jul26*│ Q4 25/26 │ YTD 25/26 │ FY25/26 │ Aug* │
│                   │       │        │ italic │  ░blue░  │ ▓emerald▓ │  grey   │      │
├───────────────────┼───────┼────────┼────────┼──────────┼───────────┼─────────┼──────┤
│ FINANCE                                                                             │
│ Gross margin  %   │       │        │        │          │           │         │      │
│    budget         │[ 95 ] │[  95 ] │[  95 ] │   92.3   │   94.3    │  93.7   │[ 95 ]│
│    actual         │ 91.6  │  91.6  │   ·    │ 91.6 99% │  90.2 96% │ 90.2 96%│  ·   │
│    same mo. last yr│  —   │   87   │   87   │   87     │    87     │   87    │  89.5│
│ Net burn  kr      │       │        │        │          │           │         │      │
│    budget         │[266k] │[ 266k ]│[ 266k ]│   798k   │  4.465k   │ 4.731k  │[266k]│
│    actual         │ 371k  │  371k  │   ·    │ 742k 93% │ 4.434k 99%│4.434k 94│  ·   │
└────────────────────────────────────────────────────────────────────────────────────┘
  every budget cell is an always-on input — click any one and type; Tab moves right →
```

**#1 Heatmap on + exceptions** — actual cells tint by variance (meaning-aware, opacity ∝ magnitude):

```
 Numbers │[Heatmap]
 ⚠ Jun 26   ▲ Net burn +14%   ▼ New MRR 71%   ▲ S&M +9%   ▽ GM −4pts     ← worst-first chips,
 ───────────────────────────────────────────────────────────────────       click → flash cell
   Net burn  actual │ 371k▓ │ 371k▓ │ … │     ▓ over-budget (red; darker = worse)
   New logos actual │   8▒  │  13░  │ … │     ░ on-plan green · ▒ watch amber · ▓ red
   Gross marg actual│ 91.6▒ │ 91.6▒ │ … │     (read-only rows + rollups stay uncolored)
                                                              hover → legend
```

**#2 Fill & paste:**

```
 Fill handle (drag → / ⌘R)                Paste a column from Excel (⌘V on a cell)
   Net burn budget                          ┌ Paste 12 values into Net burn ───────┐
   [266k]┐  grab corner, drag right         │ Jul 26 → Jun 27   ⏎ apply    Esc cancel│
   [266k]│[266k][266k]…  preview outline     └────────────────────────────────────────┘
         ┘  release = fill (one batch save)    target range outlined · misalignment-proof
   → toast:  "Filled 12 cells · Undo ⌘Z"      filled cells ripple-highlight in sequence
```

**#3 Runway / cash:**

```
 ┌ Runway ────────────────────────────────────────────────────────────────────────┐
 │ Cash on hand [ 12.400.000 kr ]     4.7 months runway     ⚠ cash-zero  Nov 26     │ ← number
 │ cash ▇▆▆▅▄▄▃▃▂▂▁▁▁▁▁▁▁▁▁▁▁▁ ────────────────────────── 0                          │   reddens
 │      Aug        Now●              Nov ✖ (dips red below 0)                        │   <6 mo
 └──────────────────────────────────────────────────────────────────────────────────┘
   actual burn for closed months · budgeted burn ahead → self-corrects as actuals land
```

**#4 Auto-suggest (ghosts in empty future cells):**

```
 Suggest from actuals [●]
   Net burn  budget │ … Jun26● │  Jul26* │  Aug26* │  Sep26* │
                    │   266k   │  ✦266k  │  ✦266k  │  ✦271k  │  ✦ = ghost (dim italic),
                    │          │   └ Tab to accept ─────────┘     from trailing actuals
   [ ✦ Accept all in Finance → ]      focus a ghost → it becomes the editable default
```

**#5 Reconcile New-MRR vs Forecast:**

```
 SALES TARGETS
   New MRR  budget    │ … │ 1.500k │ 1.500k │  ← your plan
            actual    │ … │ 1.899k │   ·    │
   ┄ predicted (fcst) │ … │  ~1.2M │  ~1.2M │  ← ghost rows in the Forecast tool's
   ┄ best      (fcst) │ … │  ~1.6M │  ~1.6M │     scenario colours (teal/green)
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ ⓘ New-MRR budget is 22% above Predicted and above Best — likely unfundable.        │
 │                                                              view in Forecast →    │  ← calm inline note
 └──────────────────────────────────────────────────────────────────────────────────┘
```

**#6 Lock / close a month:**

```
   FY25/26  [ Close FY → ]                              (or close a single month)
   ─────────────────────────────────────────────────────────────────────────────────
                  May26🔒  Jun26●   Jul26* │ Q4 25/26 │ FY re-forecast │ FY25/26
   Net burn actual 371k🔒   371k     ·     │  742k    │   4.731.000    │ 4.731.000
                   └ desaturated, read-only          plan-of-record ▲+2% drift
   closed months are immutable (book of record) · re-forecast = actuals-to-date + remaining budget
```

---

## Shared foundation (folded into PR 1 & 2)

**A. Registry extensions** — `src/lib/budget.ts`, `BUDGET_METRICS`:
add to each `BudgetMetric`:
- `goodDirection: "higher" | "lower" | "neutral"`
  - higher: gross_margin_pct, target_new_mrr, target_new_logos, target_pipeline, target_meetings, target_calls
  - lower: monthly_cogs, monthly_burn, total_cac, cac_outbound/partner/inbound
  - neutral: employee_count
- `tolerancePct?: number` — variance band for the exceptions strip (e.g. burn 10, gross margin 3, new MRR 15). Default 10.

**B. Batch save** — `POST /api/budget/batch` (new), used by fill + paste:
body `{ entries: { month, metricKey, field: "budget"|"actual", value }[] }`,
validates each (same rules as PUT), upserts budgets in one `budget_entries` upsert
and finance actuals via grouped read-merge per month. Returns `{ ok, count }`.

---

## Sequence & dependencies

| # | Feature | DB migration | Depends on | Effort |
|---|---------|-------------|-----------|--------|
| 1 | Variance heatmap + exceptions | — | foundation A | M |
| 2 | Fill-down/right + paste | — | foundation B | M |
| 3 | Runway / cash line | `settings.cash_on_hand` | — | M |
| 4 | Auto-suggest budgets | — | forecast engine | M |
| 5 | Reconcile vs Forecast | — | `/api/forecast` | M–L |
| 6 | Lock / close a month | 3 new tables | — | L |

---

## PR 1 — Variance heatmap + exceptions strip

**Lib** (`budget.ts`, TDD):
- `signedVariancePct(actual, budget): number | null` = `(actual − budget) / |budget| × 100` (null if budget 0/null).
- `varianceBucket(goodDirection, signedVariancePct): "good" | "warn" | "bad" | "neutral"` — direction-aware: for `lower`, positive variance (over budget) → bad; for `higher`, negative variance (under) → bad; band thresholds (±tolerance → warn, beyond → bad).
- `monthExceptions(month, rows): { metricKey, label, budget, actual, variancePct, severity }[]` — metrics whose `|variance|` breaches `tolerancePct` for that month, sorted worst-first.

**UI** (`BudgetGrid.tsx`):
- Header toggle `Numbers | Heatmap`. In Heatmap mode, each **actual** month-cell gets a `bg` tint from `varianceBucket` (green/amber/red/none) via a `heatClass(bucket)` helper.
- **Exceptions strip** above the table: for the current month and the most-recent-closed month, render `monthExceptions(...)` as compact chips (`Net burn +14% · GM −4pts · New MRR 71%`). Empty → "On plan ✓".
- Toggle state in `useState`; no data changes.

**Tests**: `signedVariancePct`, `varianceBucket` (both directions, all bands), `monthExceptions`. ~10.

---

## PR 2 — Fill-down / fill-right + paste a column

**API**: `POST /api/budget/batch` (foundation B).

**Lib** (`budget.ts`, TDD):
- `fillRightTargets(startMonth, months): string[]` — `startMonth` + every later month in the window (for "same number forward").
- `fillDownTargets(metricKey, section, BUDGET_METRICS): string[]` — sibling metric keys in the same sub-group (e.g. Outbound/Partner/Inbound).
- `parseClipboard(text): string[]` — split on `\n` / `\t`, trim, drop blanks.
- `planPaste(anchor: {month, metricKey}, values: string[], orientation, editableMonths): { month, metricKey, value }[]` — map pasted values onto consecutive **editable** cells (down months for a column paste; across metrics otherwise), skipping non-editable.

**UI** (`BudgetGrid.tsx`):
- A fill handle (small square, bottom-right of the focused budget cell) + `Cmd/Ctrl+R` (fill right) and `Cmd/Ctrl+D` (fill down sub-group); both build the target list, write via batch, optimistic `setBudgets`.
- `onPaste` on a focused cell → `parseClipboard` → `planPaste` → confirm chip ("48 cells will change") → batch save.
- After batch, cells resync via the existing key-by-value remount (already shipped).

**Tests**: `fillRightTargets`, `fillDownTargets`, `parseClipboard`, `planPaste` (alignment, skips synced/future-actual). ~10.

**Risk**: paste misalignment → the confirm-count preview gates it.

---

## PR 3 — Runway / cash-zero line

**DB migration** `add_settings_cash_on_hand`: `alter table settings add column cash_on_hand bigint;` (øre). Update `database.types`.

**Lib** (`budget.ts`, TDD):
- `projectCashRunway(startingCashOre, startMonth, burnByMonth: {month, burn}[]): { month, cash }[]` — `cash[m] = startingCash − Σ burn up to m`; burn = actual for closed months, budget for future.
- `monthsOfRunway(startingCashOre, avgMonthlyBurnOre): number | null`.
- `cashZeroMonth(series): string | null` — first month `cash ≤ 0`.

**API** (`/api/budget` GET): add `cash_on_hand` to the settings select; return `cashOnHand` (latest non-null) + its month. Net burn series already derivable from returned budgets/actuals.

**UI** (`BudgetGrid.tsx`): a **Runway** block under Finance — editable `Cash on hand` (kr) input (saved via `/api/budget` field `actual`/a new `cash` field), a bold **months of runway** + **cash-zero month**, red when runway < 6 mo (configurable). Optional: a faint cash line at the foot of the grid per month.

**Tests**: `projectCashRunway`, `monthsOfRunway`, `cashZeroMonth` (incl. zero/negative burn, never-zero). ~8.

---

## PR 4 — Auto-suggest budgets from trailing actuals (ghost prefill)

**Lib** (`budget.ts`, TDD):
- `suggestBudget(metric, month, history: {month, actual}[]): number | null` — trailing-window suggestion per metric: sales rows → trailing-3-mo avg of synced actual; COGS/burn/S&M → trailing actual run-rate (last actual or 3-mo avg); gross margin → trailing avg; logos/meetings/calls → trailing avg. (Optionally reuse the forecast engine's `computePredictedAssumptions` for MRR/logos/churn to stay consistent with the Forecast tool.)

**API**: none — the GET already returns all actuals; compute suggestions client-side.

**UI** (`BudgetGrid.tsx`): empty **future** budget cells show the suggestion as a **dimmed placeholder** (ghost). `Tab` or `→`-accept (or click) writes it as a real `budget_entries` row. A header switch "Suggest from actuals" on/off. Replaces the current blunt carry-forward feel for future columns.

**Tests**: `suggestBudget` for each metric family (sales avg, finance run-rate, margin avg, empty history). ~8.

---

## PR 5 — Reconcile New-MRR budget vs Forecast

**Lib** (`budget.ts` or `forecast.ts`, TDD):
- `forecastNewMrrByMonth(forecast: ForecastResult, scenario): Record<string, number>` — projected gross new MRR per month = `newLogoAmount + pipelineAmount` from `projectScenario` output.
- `reconcileNewMrr(budgetByMonth, forecastByScenario): { divergencePct, band: "below-worst"|"within"|"above-best", message }` — compares the budget's New-MRR plan (sum over horizon) to predicted/worst/best.

**API/data**: `BudgetGrid` fetches `/api/forecast?horizon=<budget window>&window=…` once (shared shape with ForecastPage).

**UI**: under the **New MRR** budget row, render ghost reference rows for **predicted / worst / best** (greyed), and a one-line banner when `reconcileNewMrr` flags divergence (`"New-MRR budget is 22% above Predicted and above Best — likely unfundable"`).

**Tests**: `forecastNewMrrByMonth`, `reconcileNewMrr` (all bands). ~8.

---

## PR 6 — Lock / close a month (plan-of-record + immutable actuals)

**DB migration** `add_budget_close`:
- `budget_month_status (month text primary key, status text default 'open', closed_at timestamptz, closed_by text)`
- `budget_plan_of_record (month text, metric_key text, budget numeric, closed_at timestamptz, primary key(month, metric_key))`
- `actuals_of_record (month text, metric_key text, actual numeric, closed_at timestamptz, primary key(month, metric_key))`

**API**:
- `POST /api/budget/close { month }` → snapshot live `budget_entries` → `budget_plan_of_record`, snapshot finance actuals (settings) + synced sales actuals → `actuals_of_record`, set status `closed`.
- `POST /api/budget/reopen { month }` → status `open` (snapshots retained).
- `PUT`/`batch` reject edits to finance actuals of a `closed` month (budget edits become a "re-forecast" layer — still allowed, compared against plan-of-record).
- GET returns `monthStatus`, `planOfRecord`, `actualsOfRecord`.

**Lib** (`budget.ts`, TDD):
- `fullYearReforecast(fyMonths, actualsOfRecord/actuals, budgets, metric): number | null` — actuals for closed months + budget for the rest (a live landing-spot total).
- `isMonthEditable(monthStatus, field): boolean`.

**UI** (`BudgetGrid.tsx`):
- Per-FY (or per-month) **Close** / **Reopen** control; closed months grey their **actual** inputs (read-only) and badge "Closed".
- Optional rows: **plan of record** vs **current** vs **actual** for closed periods.
- A **Full-year re-forecast** column (actuals-to-date + remaining-months budget) next to the FY total.

**Tests**: `fullYearReforecast`, `isMonthEditable`, snapshot mapping. ~8.

**Risk**: most invasive. Ship last; keep "re-forecast layer" minimal (lock actuals + plan-of-record snapshot + the re-forecast column) and defer full versioned diff UI if needed.

---

## Cross-cutting

- **Pure-first TDD**: every new behavior lands as tested `budget.ts` helpers before any UI (matches existing 26-test budget module).
- **Performance**: heatmap/ghost/suggestions are className/placeholder over existing state — no new per-cell React state (preserve the no-freeze guarantee). Fill/paste/batch write through the existing key-by-value resync.
- **Units**: all kr stay in øre; reuse `toDisplayNumber`/`fromDisplayNumber`/`formatValue`.
- **No new deps.**

## Verification (each PR)
`npx tsc --noEmit` · `npm test` (new helper tests green) · `npm run build` · ship as a PR, merge to deploy.

## Risks / assumptions
- Forecast reconcile (PR 5) assumes the forecast horizon can cover the budget window; clamp to available months.
- Lock (PR 6) changes the data model; the snapshot tables are additive (no existing data touched).
- Heatmap direction config (PR 1) must be right per metric or colors mislead — covered by tests.
