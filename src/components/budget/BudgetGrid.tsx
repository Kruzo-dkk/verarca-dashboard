"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUDGET_METRICS,
  type BudgetMetric,
  type BudgetSection,
  fiscalYearMonths,
  fiscalQuarterMonths,
  fiscalYTDMonths,
  fiscalYearLabel,
  fiscalQuarterLabel,
  fiscalYearEndYear,
  fiscalQuarter,
  rollupValues,
  attainmentPct,
} from "@/lib/budget";

interface BudgetGridData {
  months: string[];
  currentMonth: string;
  budgets: Record<string, Record<string, number>>;
  financeActuals: Record<string, Record<string, number>>;
  salesActuals: Record<string, Record<string, number>>;
}

type View = "monthly" | "quarterly" | "yearly";

const SECTIONS: BudgetSection[] = ["Finance", "Acquisition", "Headcount", "Sales Targets"];

interface Period {
  key: string;
  label: string;
  months: string[];
  editable: boolean; // single, real month → cells are inputs
  isCurrent: boolean;
  isFuture: boolean;
  isSummary: boolean; // YTD column
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_ABBR[mo - 1]} ${String(y).slice(-2)}`;
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

export function BudgetGrid() {
  const [data, setData] = useState<BudgetGridData | null>(null);
  const [view, setView] = useState<View>("monthly");
  const [budgets, setBudgets] = useState<Record<string, Record<string, number>>>({});
  const [financeActuals, setFinanceActuals] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
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
    if (data && view === "monthly") currentRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [data, view]);

  function setLocal(
    setter: typeof setBudgets,
    month: string,
    key: string,
    value: number | null
  ) {
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
      const cols: Period[] = months.map((m) => ({
        key: m,
        label: monthLabel(m),
        months: [m],
        editable: true,
        isCurrent: m === currentMonth,
        isFuture: m > currentMonth,
        isSummary: false,
      }));
      cols.push({
        key: "ytd",
        label: `YTD ${fiscalYearLabel(currentMonth)}`,
        months: fiscalYTDMonths(currentMonth),
        editable: false,
        isCurrent: false,
        isFuture: false,
        isSummary: true,
      });
      return cols;
    }
    if (view === "quarterly") {
      const seen = new Map<string, Period>();
      for (const m of months) {
        const k = `${fiscalYearEndYear(m)}-Q${fiscalQuarter(m)}`;
        if (!seen.has(k)) {
          seen.set(k, {
            key: k,
            label: fiscalQuarterLabel(m),
            months: fiscalQuarterMonths(m),
            editable: false,
            isCurrent: fiscalQuarterMonths(m).includes(currentMonth),
            isFuture: fiscalQuarterMonths(m)[0] > currentMonth,
            isSummary: false,
          });
        }
      }
      return [...seen.values()];
    }
    // yearly
    const seen = new Map<string, Period>();
    for (const m of months) {
      const k = String(fiscalYearEndYear(m));
      if (!seen.has(k)) {
        seen.set(k, {
          key: k,
          label: fiscalYearLabel(m),
          months: fiscalYearMonths(m),
          editable: false,
          isCurrent: fiscalYearMonths(m).includes(currentMonth),
          isFuture: fiscalYearMonths(m)[0] > currentMonth,
          isSummary: false,
        });
      }
    }
    return [...seen.values()];
  }, [data, view]);

  if (error) {
    return <div className="p-6 text-[var(--text-muted)]">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-[var(--text-muted)]">Loading budget…</div>;
  }

  const stickyCol = "sticky left-0 z-10 bg-white";
  const numCell = "px-2 py-1 text-right tabular-nums whitespace-nowrap text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Monthly Input — Budget vs Actual</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Fiscal year 1 Aug – 31 Jul · budget editable up to 24 months ahead · grey = synced actual
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] min-w-[64px] text-right">
            {inFlight > 0 ? "Saving…" : savedAt ? "Saved ✓" : ""}
          </span>
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-sm">
            {(["monthly", "quarterly", "yearly"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1 capitalize ${
                  view === v
                    ? "bg-[var(--text-primary)] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

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
                  ref={p.isCurrent && view === "monthly" ? currentRef : undefined}
                  className={`px-2 py-2 text-right font-medium whitespace-nowrap min-w-[84px] ${
                    p.isSummary
                      ? "text-[var(--text-primary)] border-l border-gray-200 bg-[var(--text-primary)]/5"
                      : p.isCurrent
                        ? "text-[var(--text-primary)] bg-[var(--text-primary)]/5"
                        : p.isFuture
                          ? "text-[var(--text-muted)] italic"
                          : "text-[var(--text-muted)]"
                  }`}
                >
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((section) => {
              const metrics = BUDGET_METRICS.filter((m) => m.section === section);
              return (
                <SectionRows
                  key={section}
                  section={section}
                  metrics={metrics}
                  periods={periods}
                  colCount={periods.length + 1}
                  budgetOf={budgetOf}
                  actualOf={actualOf}
                  onSave={save}
                  stickyCol={stickyCol}
                  numCell={numCell}
                />
              );
            })}
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
}: {
  metric: BudgetMetric;
  periods: Period[];
  budgetOf: (m: string, key: string) => number | null;
  actualOf: (m: string, metric: BudgetMetric) => number | null;
  onSave: (month: string, key: string, field: "budget" | "actual", value: number | null) => void;
  stickyCol: string;
  numCell: string;
}) {
  const unit = metric.unit === "kr" ? "kr" : metric.unit === "%" ? "%" : "#";
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
          const val = p.editable
            ? budgetOf(p.months[0], metric.key)
            : rollupValues(p.months.map((m) => budgetOf(m, metric.key)), metric.rollup);
          const cls = `${numCell} ${p.isSummary ? "border-l border-gray-200 bg-[var(--text-primary)]/5" : p.isCurrent ? "bg-[var(--text-primary)]/5" : ""}`;
          return (
            <td key={p.key} className={cls}>
              {p.editable ? (
                <NumberCell
                  value={val}
                  metric={metric}
                  onSave={(v) => onSave(p.months[0], metric.key, "budget", v)}
                />
              ) : (
                <span className="text-[var(--text-primary)]">{formatValue(val, metric)}</span>
              )}
            </td>
          );
        })}
      </tr>
      {/* Actual row */}
      <tr>
        <td className={`${stickyCol} px-3 pb-1`}>
          <div className="text-[10px] text-[var(--text-muted)] pl-2">
            actual{metric.actual === "synced" ? " (synced)" : ""}
          </div>
        </td>
        {periods.map((p) => {
          const editableActual = p.editable && metric.actual === "settings" && !p.isFuture;
          const val = p.editable
            ? actualOf(p.months[0], metric)
            : rollupValues(p.months.map((m) => actualOf(m, metric)), metric.rollup);
          const budgetVal = p.editable
            ? budgetOf(p.months[0], metric.key)
            : rollupValues(p.months.map((m) => budgetOf(m, metric.key)), metric.rollup);
          const att = p.isSummary || !p.editable ? attainmentPct(val, budgetVal) : null;
          const cls = `${numCell} text-[var(--text-muted)] ${p.isSummary ? "border-l border-gray-200 bg-[var(--text-primary)]/5" : p.isCurrent ? "bg-[var(--text-primary)]/5" : ""}`;
          return (
            <td key={p.key} className={cls}>
              {editableActual ? (
                <NumberCell
                  value={val}
                  metric={metric}
                  muted
                  onSave={(v) => onSave(p.months[0], metric.key, "actual", v)}
                />
              ) : p.editable && p.isFuture ? (
                <span className="text-[var(--text-muted)]/40">·</span>
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
    </>
  );
}

function NumberCell({
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
  const [v, setV] = useState(display);
  useEffect(() => setV(display), [display]);

  return (
    <input
      inputMode="decimal"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const native = fromDisplayNumber(v, metric);
        if (v.trim() !== "" && native == null) {
          setV(display); // invalid → revert
          return;
        }
        if (native !== value) onSave(native);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      placeholder="—"
      className={`w-[72px] bg-transparent text-right tabular-nums outline-none focus:ring-1 focus:ring-[var(--text-primary)]/30 rounded px-1 ${
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      } placeholder:text-[var(--text-muted)]/40`}
    />
  );
}
