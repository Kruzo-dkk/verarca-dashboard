"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUDGET_METRICS,
  type BudgetMetric,
  type BudgetSection,
  type BudgetException,
  type MetricCell,
  type VarianceBucket,
  addMonths,
  fiscalYearMonths,
  fiscalQuarterMonths,
  fiscalYTDMonths,
  fiscalYearLabel,
  fiscalQuarterLabel,
  fiscalYearEndYear,
  fiscalQuarter,
  rollupValues,
  attainmentPct,
  signedVariancePct,
  heatScale,
  monthExceptions,
} from "@/lib/budget";

interface BudgetGridData {
  months: string[];
  currentMonth: string;
  budgets: Record<string, Record<string, number>>;
  financeActuals: Record<string, Record<string, number>>;
  salesActuals: Record<string, Record<string, number>>;
}

type View = "monthly" | "quarterly" | "yearly";
type PeriodKind = "month" | "quarter" | "year" | "ytd";

const SECTIONS: BudgetSection[] = ["Finance", "Acquisition", "Headcount", "Sales Targets"];

interface Period {
  key: string;
  label: string;
  months: string[];
  editable: boolean; // single real month → cells are inputs
  isCurrent: boolean;
  isFuture: boolean;
  kind: PeriodKind;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_ABBR[mo - 1]} ${String(y).slice(-2)}`;
}
function isFiscalQuarterEnd(m: string): boolean {
  const fqm = fiscalQuarterMonths(m);
  return fqm[fqm.length - 1] === m;
}
function isFiscalYearEnd(m: string): boolean {
  return m.endsWith("-07"); // July ends the fiscal year
}

function toDisplayNumber(value: number | null, metric: BudgetMetric): string {
  if (value == null) return "";
  return String(metric.ore ? Math.round(value / 100) : value);
}
function fromDisplayNumber(input: string, metric: BudgetMetric): number | null {
  const t = input.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return metric.ore ? Math.round(n * 100) : n;
}
function formatValue(value: number | null, metric: BudgetMetric): string {
  if (value == null) return "—";
  if (metric.unit === "kr") {
    return Math.round(metric.ore ? value / 100 : value).toLocaleString("da-DK");
  }
  if (metric.unit === "%") return `${Math.round(value * 100) / 100}%`;
  return `${value}`;
}

function colClasses(kind: PeriodKind, isCurrent: boolean): string {
  if (kind === "year") return "border-l-2 border-gray-300 bg-gray-100";
  if (kind === "quarter") return "border-l border-blue-200 bg-blue-50";
  if (kind === "ytd") return "border-l border-emerald-200 bg-emerald-50";
  return isCurrent ? "bg-gray-50" : "";
}

type Mode = "numbers" | "heatmap";

/** Stable DOM id for an actual month cell, so exception chips can scroll to it. */
function cellId(month: string, key: string): string {
  return `bcell-${month}-${key}`;
}

/** Heat background for an actual cell: good = emerald, warn/bad = red, by opacity. */
function heatColor(bucket: VarianceBucket, opacity: number): string | undefined {
  if (opacity <= 0) return undefined;
  const rgb = bucket === "good" ? "16,185,129" : "239,68,68";
  return `rgba(${rgb},${opacity})`;
}

export function BudgetGrid() {
  const [data, setData] = useState<BudgetGridData | null>(null);
  const [view, setView] = useState<View>("monthly");
  const [budgets, setBudgets] = useState<Record<string, Record<string, number>>>({});
  const [financeActuals, setFinanceActuals] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("numbers");
  const [flashId, setFlashId] = useState<string | null>(null);
  const currentRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/budget");
        if (!res.ok) {
          setError((await res.json().catch(() => ({})))?.error ?? "Failed to load");
          return;
        }
        const d: BudgetGridData = await res.json();
        setData(d);
        setBudgets(d.budgets ?? {});
        setFinanceActuals(d.financeActuals ?? {});
      } catch {
        setError("Failed to load budget");
      }
    })();
  }, []);

  useEffect(() => {
    if (data && view === "monthly") currentRef.current?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [data, view]);

  // Restore the Numbers/Heatmap preference once on mount.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("budgetMode");
      if (saved === "heatmap" || saved === "numbers") setMode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function changeMode(m: Mode) {
    setMode(m);
    try {
      window.localStorage.setItem("budgetMode", m);
    } catch {
      /* ignore */
    }
  }

  // Clicking an exception chip scrolls its cell into view and flashes it briefly.
  useEffect(() => {
    if (!flashId) return;
    document
      .getElementById(flashId)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setFlashId(null), 1400);
    return () => clearTimeout(t);
  }, [flashId]);

  function setLocal(setter: typeof setBudgets, month: string, key: string, value: number | null) {
    setter((prev) => {
      const next = { ...prev, [month]: { ...(prev[month] ?? {}) } };
      if (value == null) delete next[month][key];
      else next[month][key] = value;
      return next;
    });
  }

  async function save(month: string, metricKey: string, field: "budget" | "actual", value: number | null) {
    setLocal(field === "budget" ? setBudgets : setFinanceActuals, month, metricKey, value);
    setInFlight((n) => n + 1);
    try {
      await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, metricKey, field, value }),
      });
      setSavedAt(Date.now());
    } catch {
      setError("Save failed — check your connection");
    } finally {
      setInFlight((n) => n - 1);
    }
  }

  const budgetOf = (m: string, key: string) => budgets[m]?.[key] ?? null;
  const actualOf = (m: string, metric: BudgetMetric) =>
    metric.actual === "settings"
      ? financeActuals[m]?.[metric.key] ?? null
      : data?.salesActuals?.[m]?.[metric.key] ?? null;

  const periods = useMemo<Period[]>(() => {
    if (!data) return [];
    const { months, currentMonth } = data;

    if (view === "monthly") {
      // Show from the start of the PRIOR fiscal year (Aug, two FYs back) through
      // 24 months ahead, so the full previous fiscal year is included. Even older
      // history stays available in the Quarterly / Yearly views.
      const visStart = addMonths(fiscalYearMonths(currentMonth)[0], -12);
      const cols: Period[] = [];
      for (const m of months) {
        if (m < visStart) continue;
        cols.push({
          key: m,
          label: monthLabel(m),
          months: [m],
          editable: true,
          isCurrent: m === currentMonth,
          isFuture: m > currentMonth,
          kind: "month",
        });
        if (isFiscalQuarterEnd(m)) {
          const fqm = fiscalQuarterMonths(m);
          cols.push({
            key: `q-${m}`,
            label: `Q${fiscalQuarter(m)} ${fiscalYearLabel(m)}`,
            months: fqm,
            editable: false,
            isCurrent: fqm.includes(currentMonth),
            isFuture: fqm[0] > currentMonth,
            kind: "quarter",
          });
          // YTD sits right after the current quarter's total.
          if (fqm.includes(currentMonth)) {
            cols.push({
              key: `ytd-${currentMonth}`,
              label: `YTD ${fiscalYearLabel(currentMonth)}`,
              months: fiscalYTDMonths(currentMonth),
              editable: false,
              isCurrent: false,
              isFuture: false,
              kind: "ytd",
            });
          }
        }
        if (isFiscalYearEnd(m)) {
          const fym = fiscalYearMonths(m);
          cols.push({
            key: `y-${m}`,
            label: fiscalYearLabel(m),
            months: fym,
            editable: false,
            isCurrent: fym.includes(currentMonth),
            isFuture: fym[0] > currentMonth,
            kind: "year",
          });
        }
      }
      return cols;
    }

    const grouping = view === "quarterly" ? "quarter" : "year";
    const seen = new Map<string, Period>();
    for (const m of months) {
      const k =
        grouping === "quarter" ? `${fiscalYearEndYear(m)}-Q${fiscalQuarter(m)}` : String(fiscalYearEndYear(m));
      if (seen.has(k)) continue;
      const pm = grouping === "quarter" ? fiscalQuarterMonths(m) : fiscalYearMonths(m);
      seen.set(k, {
        key: k,
        label: grouping === "quarter" ? fiscalQuarterLabel(m) : fiscalYearLabel(m),
        months: pm,
        editable: false,
        isCurrent: pm.includes(currentMonth),
        isFuture: pm[0] > currentMonth,
        kind: grouping,
      });
    }
    return [...seen.values()];
  }, [data, view]);

  // Off-plan metrics for the most-recent completed month (the previous calendar
  // month — the current month's actuals are still partial, which would spam
  // false misses). Worst-first; empty = on plan.
  const exMonth = data ? addMonths(data.currentMonth, -1) : "";
  const exceptions = useMemo<BudgetException[]>(() => {
    if (!data) return [];
    const m = addMonths(data.currentMonth, -1);
    const rows: MetricCell[] = BUDGET_METRICS.map((metric) => {
      const actual =
        metric.actual === "settings"
          ? financeActuals[m]?.[metric.key] ?? null
          : data.salesActuals?.[m]?.[metric.key] ?? null;
      return { metric, budget: budgets[m]?.[metric.key] ?? null, actual };
    });
    return monthExceptions(rows);
  }, [data, budgets, financeActuals]);

  if (error) return <div className="p-6 text-[var(--text-muted)]">{error}</div>;
  if (!data) return <div className="p-6 text-[var(--text-muted)]">Loading budget…</div>;

  const stickyCol = "sticky left-0 z-10 bg-white";
  const numCell = "px-2 py-1 text-right tabular-nums whitespace-nowrap text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Budget</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Budget vs Actual · fiscal year 1 Aug – 31 Jul · budget editable up to 24 months ahead · grey = synced actual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] min-w-[64px] text-right">
            {inFlight > 0 ? "Saving…" : savedAt ? "Saved ✓" : ""}
          </span>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
            {(["numbers", "heatmap"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeMode(m)}
                className={`px-3 py-1 capitalize transition-colors ${
                  mode === m
                    ? "bg-[var(--text-primary)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
            {(["monthly", "quarterly", "yearly"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1 capitalize ${
                  view === v ? "bg-[var(--text-primary)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {exMonth &&
        (exceptions.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Off plan · {monthLabel(exMonth)}
            </span>
            {exceptions.map((e) => (
              <button
                key={e.metricKey}
                type="button"
                onClick={() => setFlashId(cellId(exMonth, e.metricKey))}
                title={`${e.label}: actual vs budget`}
                className={`text-xs rounded-full px-2 py-0.5 border transition-colors ${
                  e.severity === "bad"
                    ? "border-red-300 bg-red-100 text-red-700 hover:bg-red-200"
                    : "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200"
                }`}
              >
                {e.label} {e.variancePct > 0 ? "+" : ""}
                {e.variancePct}%
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
            On plan ✓ · {monthLabel(exMonth)}
          </div>
        ))}

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={`${stickyCol} px-3 py-2 text-left font-medium text-[var(--text-muted)] min-w-[200px]`}>
                Metric
              </th>
              {periods.map((p) => (
                <th
                  key={p.key}
                  ref={p.isCurrent && p.kind === "month" ? currentRef : undefined}
                  className={`px-2 py-2 text-right font-medium whitespace-nowrap min-w-[84px] ${colClasses(
                    p.kind,
                    p.isCurrent
                  )} ${
                    p.kind === "month"
                      ? p.isFuture
                        ? "text-[var(--text-muted)] italic"
                        : "text-[var(--text-muted)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => (
              <SectionRows
                key={section}
                section={section}
                metrics={BUDGET_METRICS.filter((m) => m.section === section)}
                periods={periods}
                colCount={periods.length + 1}
                budgetOf={budgetOf}
                actualOf={actualOf}
                onSave={save}
                stickyCol={stickyCol}
                numCell={numCell}
                mode={mode}
                flashId={flashId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  metrics,
  periods,
  colCount,
  budgetOf,
  actualOf,
  onSave,
  stickyCol,
  numCell,
  mode,
  flashId,
}: {
  section: BudgetSection;
  metrics: BudgetMetric[];
  periods: Period[];
  colCount: number;
  budgetOf: (m: string, key: string) => number | null;
  actualOf: (m: string, metric: BudgetMetric) => number | null;
  onSave: (month: string, key: string, field: "budget" | "actual", value: number | null) => void;
  stickyCol: string;
  numCell: string;
  mode: Mode;
  flashId: string | null;
}) {
  return (
    <>
      <tr className="bg-[var(--text-primary)]/[0.03]">
        <td
          colSpan={colCount}
          className={`${stickyCol} px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]`}
        >
          {section}
        </td>
      </tr>
      {metrics.map((metric) => (
        <MetricRows
          key={metric.key}
          metric={metric}
          periods={periods}
          budgetOf={budgetOf}
          actualOf={actualOf}
          onSave={onSave}
          stickyCol={stickyCol}
          numCell={numCell}
          mode={mode}
          flashId={flashId}
        />
      ))}
    </>
  );
}

function MetricRows({
  metric,
  periods,
  budgetOf,
  actualOf,
  onSave,
  stickyCol,
  numCell,
  mode,
  flashId,
}: {
  metric: BudgetMetric;
  periods: Period[];
  budgetOf: (m: string, key: string) => number | null;
  actualOf: (m: string, metric: BudgetMetric) => number | null;
  onSave: (month: string, key: string, field: "budget" | "actual", value: number | null) => void;
  stickyCol: string;
  numCell: string;
  mode: Mode;
  flashId: string | null;
}) {
  const unit = metric.unit === "kr" ? "kr" : metric.unit === "%" ? "%" : "#";

  const rollup = (p: Period, get: (m: string) => number | null) =>
    p.kind === "month" ? get(p.months[0]) : rollupValues(p.months.map(get), metric.rollup);

  return (
    <>
      {/* Budget row */}
      <tr className="border-t border-gray-100">
        <td className={`${stickyCol} px-3 py-1`}>
          <div className="text-[var(--text-primary)]">
            {metric.label} <span className="text-[10px] text-[var(--text-muted)]">{unit}</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">budget</div>
        </td>
        {periods.map((p) => {
          const val = rollup(p, (m) => budgetOf(m, metric.key));
          return (
            <td key={p.key} className={`${numCell} ${colClasses(p.kind, p.isCurrent)}`}>
              {p.kind === "month" ? (
                <EditableCell value={val} metric={metric} onSave={(v) => onSave(p.months[0], metric.key, "budget", v)} />
              ) : (
                <span className="text-[var(--text-primary)]">{formatValue(val, metric)}</span>
              )}
            </td>
          );
        })}
      </tr>
      {/* Actual row */}
      <tr>
        <td className={`${stickyCol} px-3`}>
          <div className="text-[10px] text-[var(--text-muted)] pl-2">
            actual{metric.actual === "synced" ? " (synced)" : ""}
          </div>
        </td>
        {periods.map((p) => {
          const editableActual = p.kind === "month" && metric.actual === "settings" && !p.isFuture;
          const val = rollup(p, (m) => actualOf(m, metric));
          const budgetVal = rollup(p, (m) => budgetOf(m, metric.key));
          const att = p.kind !== "month" ? attainmentPct(val, budgetVal) : null;
          const isMonth = p.kind === "month";
          const id = isMonth ? cellId(p.months[0], metric.key) : undefined;
          const heat =
            isMonth && mode === "heatmap" && !p.isFuture
              ? heatScale(
                  metric.goodDirection,
                  signedVariancePct(val, budgetVal),
                  metric.tolerancePct
                )
              : null;
          return (
            <td
              key={p.key}
              id={id}
              style={
                heat && heat.opacity > 0
                  ? { backgroundColor: heatColor(heat.bucket, heat.opacity) }
                  : undefined
              }
              className={`${numCell} text-[var(--text-muted)] ${colClasses(p.kind, p.isCurrent)} transition-shadow ${
                id != null && id === flashId ? "ring-2 ring-inset ring-amber-400" : ""
              }`}
            >
              {editableActual ? (
                <EditableCell value={val} metric={metric} muted onSave={(v) => onSave(p.months[0], metric.key, "actual", v)} />
              ) : p.kind === "month" && p.isFuture ? (
                <span className="text-gray-300">·</span>
              ) : (
                <span>
                  {formatValue(val, metric)}
                  {att != null && (
                    <span className={`ml-1 text-[10px] ${att >= 100 ? "text-emerald-600" : "text-[var(--text-muted)]"}`}>
                      {att}%
                    </span>
                  )}
                </span>
              )}
            </td>
          );
        })}
      </tr>
      {/* Same month last year row (actual −12 months) */}
      <tr>
        <td className={`${stickyCol} px-3 pb-1`}>
          <div className="text-[10px] text-gray-400 pl-2">same mo. last yr</div>
        </td>
        {periods.map((p) => {
          const val = rollup(p, (m) => actualOf(addMonths(m, -12), metric));
          return (
            <td key={p.key} className={`${numCell} text-gray-400 ${colClasses(p.kind, p.isCurrent)}`}>
              {formatValue(val, metric)}
            </td>
          );
        })}
      </tr>
    </>
  );
}

/**
 * Editable cell — an always-visible, lightweight UNCONTROLLED input. Every
 * budget month cell and every editable finance-actual cell renders one, so it's
 * obvious you can click straight in (and Tab between months). Uncontrolled means
 * no per-cell React state/effects — that's what froze the page when these were
 * controlled. defaultValue is read on mount; the grid loads once, so values stay
 * correct without controlled state.
 */
function EditableCell({
  value,
  metric,
  onSave,
  muted,
}: {
  value: number | null;
  metric: BudgetMetric;
  onSave: (v: number | null) => void;
  muted?: boolean;
}) {
  const display = toDisplayNumber(value, metric);
  return (
    <input
      // Remount when the underlying value changes externally (reload / prefill /
      // future fill-down) so the uncontrolled input never shows stale text — and
      // no per-cell state/effects, so it can't re-introduce the render freeze.
      key={display}
      type="text"
      inputMode="decimal"
      defaultValue={display}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => {
        const raw = e.target.value;
        const native = fromDisplayNumber(raw, metric);
        if (raw.trim() !== "" && native == null) {
          e.target.value = display; // revert an invalid entry
          return;
        }
        if (native !== value) onSave(native);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="—"
      aria-label={`${metric.label} ${muted ? "actual" : "budget"}`}
      className={`w-[72px] bg-transparent text-right tabular-nums rounded px-1 border border-transparent hover:border-gray-300 hover:bg-gray-50 focus:bg-white focus:border-[var(--text-primary)]/40 focus:outline-none ${
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      } placeholder:text-gray-300`}
    />
  );
}
