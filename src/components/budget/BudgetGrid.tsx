"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUDGET_METRICS,
  type BudgetMetric,
  type BudgetSection,
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
  if (kind === "quarter") return "border-l border-gray-200 bg-gray-50";
  if (kind === "ytd") return "border-l border-emerald-200 bg-emerald-50";
  return isCurrent ? "bg-gray-50" : "";
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
    if (data && view === "monthly") currentRef.current?.scrollIntoView({ inline: "start", block: "nearest" });
  }, [data, view]);

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
          return (
            <td key={p.key} className={`${numCell} text-[var(--text-muted)] ${colClasses(p.kind, p.isCurrent)}`}>
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
 * Click-to-edit cell: renders plain text and only mounts an <input> for the
 * cell being edited. Keeps the grid responsive — hundreds of always-mounted
 * inputs would block the main thread.
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
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CellInput
        value={value}
        metric={metric}
        muted={muted}
        onSave={onSave}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`w-[72px] text-right tabular-nums rounded px-1 hover:bg-gray-100 ${
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      }`}
    >
      {value == null ? <span className="text-gray-300">—</span> : formatValue(value, metric)}
    </button>
  );
}

function CellInput({
  value,
  metric,
  onSave,
  onDone,
  muted,
}: {
  value: number | null;
  metric: BudgetMetric;
  onSave: (v: number | null) => void;
  onDone: () => void;
  muted?: boolean;
}) {
  const [v, setV] = useState(toDisplayNumber(value, metric));
  return (
    <input
      autoFocus
      inputMode="decimal"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const native = fromDisplayNumber(v, metric);
        if (!(v.trim() !== "" && native == null) && native !== value) onSave(native);
        onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        else if (e.key === "Escape") onDone();
      }}
      placeholder="—"
      className={`w-[72px] bg-transparent text-right tabular-nums outline-none focus:ring-1 focus:ring-[var(--text-primary)]/30 rounded px-1 ${
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      } placeholder:text-gray-300`}
    />
  );
}
