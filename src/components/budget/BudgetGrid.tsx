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
  fillRightTargets,
  fillDownTargets,
  parseClipboard,
  flattenClipboard,
  planPaste,
  type PasteCandidate,
  projectCashRunway,
  monthsOfRunway,
  cashZeroMonth,
  type CashPoint,
  suggestBudget,
  type SuggestLookup,
  reconcileNewMrr,
} from "@/lib/budget";
import { forecastNewMrrByMonth, type ForecastMonth } from "@/lib/forecast";
import { SCENARIO_META, type ScenarioId } from "@/lib/forecast-scenarios";

interface BudgetGridData {
  months: string[];
  currentMonth: string;
  budgets: Record<string, Record<string, number>>;
  financeActuals: Record<string, Record<string, number>>;
  salesActuals: Record<string, Record<string, number>>;
  cashByMonth: Record<string, number>;
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

interface ForecastRef {
  id: ScenarioId;
  label: string;
  color: string;
  byMonth: Record<string, number>;
}

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
  const [cashByMonth, setCashByMonth] = useState<Record<string, number>>({});
  const [suggest, setSuggest] = useState(false);
  const [forecastNewMrr, setForecastNewMrr] = useState<Record<string, Record<string, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("numbers");
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastBatch, setLastBatch] = useState<
    { month: string; metricKey: string; field: "budget" | "actual"; value: number | null }[] | null
  >(null);
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
        setCashByMonth(d.cashByMonth ?? {});
      } catch {
        setError("Failed to load budget");
      }
    })();
  }, []);

  // Forecast new-MRR (predicted/best/worst) for the reconcile banner + ghost
  // reference rows. Optional context — failures are silent.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/forecast?horizon=24");
        if (!res.ok) return;
        const fr: { projections?: { scenario: string; months: ForecastMonth[] }[] } =
          await res.json();
        const byScenario: Record<string, Record<string, number>> = {};
        for (const p of fr.projections ?? []) {
          byScenario[p.scenario] = forecastNewMrrByMonth(p.months ?? []);
        }
        setForecastNewMrr(byScenario);
      } catch {
        /* forecast is optional context */
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
      if (window.localStorage.getItem("budgetSuggest") === "1") setSuggest(true);
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

  function changeSuggest(v: boolean) {
    setSuggest(v);
    try {
      window.localStorage.setItem("budgetSuggest", v ? "1" : "0");
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

  // ── Bulk editing: fill-down / fill-right (⌘D/⌘R) + column paste ──
  const editableMonths = useMemo(
    () => periods.filter((p) => p.kind === "month").map((p) => p.months[0]),
    [periods]
  );

  async function batchSave(
    entries: { month: string; metricKey: string; field: "budget" | "actual"; value: number | null }[],
    label: string
  ) {
    if (!entries.length) return;
    // Capture prior values first so the toast's Undo can restore them.
    const prior = entries.map((e) => ({
      month: e.month,
      metricKey: e.metricKey,
      field: e.field,
      value:
        e.field === "budget"
          ? budgets[e.month]?.[e.metricKey] ?? null
          : financeActuals[e.month]?.[e.metricKey] ?? null,
    }));
    for (const e of entries) {
      setLocal(e.field === "budget" ? setBudgets : setFinanceActuals, e.month, e.metricKey, e.value);
    }
    setInFlight((n) => n + 1);
    try {
      await fetch("/api/budget/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      setSavedAt(Date.now());
      setLastBatch(prior);
      setToast(label);
    } catch {
      setError("Bulk save failed — check your connection");
    } finally {
      setInFlight((n) => n - 1);
    }
  }

  async function undoLast() {
    if (!lastBatch) return;
    const entries = lastBatch;
    setLastBatch(null);
    setToast(null);
    for (const e of entries) {
      setLocal(e.field === "budget" ? setBudgets : setFinanceActuals, e.month, e.metricKey, e.value);
    }
    setInFlight((n) => n + 1);
    try {
      await fetch("/api/budget/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      setSavedAt(Date.now());
    } catch {
      setError("Undo failed — check your connection");
    } finally {
      setInFlight((n) => n - 1);
    }
  }

  function fillBudget(
    dir: "right" | "down",
    month: string,
    metricKey: string,
    nativeValue: number | null
  ) {
    const metric = BUDGET_METRICS.find((m) => m.key === metricKey);
    const targets =
      dir === "right"
        ? fillRightTargets(month, editableMonths).map((m) => ({ month: m, metricKey }))
        : fillDownTargets(metricKey, BUDGET_METRICS).map((k) => ({ month, metricKey: k }));
    if (!targets.length) return;
    const entries = [
      { month, metricKey, field: "budget" as const, value: nativeValue },
      ...targets.map((t) => ({
        month: t.month,
        metricKey: t.metricKey,
        field: "budget" as const,
        value: nativeValue,
      })),
    ];
    const label =
      dir === "right"
        ? `Filled ${metric?.label ?? metricKey} → ${targets.length} month${targets.length === 1 ? "" : "s"}`
        : `Filled down ${targets.length} metric${targets.length === 1 ? "" : "s"}`;
    batchSave(entries, label);
  }

  function pasteInto(
    month: string,
    metricKey: string,
    field: "budget" | "actual",
    text: string
  ): boolean {
    const cells = parseClipboard(text);
    const { values, orientation } = flattenClipboard(cells);
    if (values.length <= 1) return false; // single value → let the input paste natively
    const cur = data?.currentMonth ?? "";
    let candidates: PasteCandidate[];
    if (orientation === "right") {
      const start = editableMonths.indexOf(month);
      const ms = start >= 0 ? editableMonths.slice(start) : [month];
      candidates = ms.map((m) => {
        const mm = BUDGET_METRICS.find((x) => x.key === metricKey);
        return {
          month: m,
          metricKey,
          field,
          editable: field === "budget" ? true : mm?.actual === "settings" && m <= cur,
        };
      });
    } else {
      const keys = [metricKey, ...fillDownTargets(metricKey, BUDGET_METRICS)];
      candidates = keys.map((k) => {
        const mm = BUDGET_METRICS.find((x) => x.key === k);
        return {
          month,
          metricKey: k,
          field,
          editable: field === "budget" ? true : mm?.actual === "settings" && month <= cur,
        };
      });
    }
    const targets = planPaste(values, candidates);
    if (!targets.length) return false;
    const entries = targets.map((t) => {
      const mm = BUDGET_METRICS.find((x) => x.key === t.metricKey);
      const native = t.value == null ? null : mm?.ore ? Math.round(t.value * 100) : t.value;
      return { month: t.month, metricKey: t.metricKey, field: t.field, value: native };
    });
    batchSave(entries, `Pasted ${entries.length} cell${entries.length === 1 ? "" : "s"}`);
    return true;
  }

  // Cash on hand is always stored against the current month (a management figure).
  function saveCash(native: number | null) {
    const cur = data?.currentMonth;
    if (!cur) return;
    setCashByMonth((prev) => {
      const next = { ...prev };
      if (native == null) delete next[cur];
      else next[cur] = native;
      return next;
    });
    setInFlight((n) => n + 1);
    fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: cur, field: "cash", value: native }),
    })
      .then(() => setSavedAt(Date.now()))
      .catch(() => setError("Cash save failed — check your connection"))
      .finally(() => setInFlight((n) => n - 1));
  }

  // ── Budget suggestions from trailing actuals (no-ERP-friendly) ──
  const suggestLookup: SuggestLookup = {
    actual: (k, m) => {
      const metric = BUDGET_METRICS.find((x) => x.key === k);
      return (
        (metric?.actual === "settings"
          ? financeActuals[m]?.[k]
          : data?.salesActuals?.[m]?.[k]) ?? null
      );
    },
    budget: (k, m) => budgets[m]?.[k] ?? null,
  };
  function suggestionFor(metric: BudgetMetric, month: string): number | null {
    return suggestBudget(metric, month, suggestLookup);
  }
  function acceptSuggestions(section: BudgetSection) {
    const cur = data?.currentMonth;
    if (!cur) return;
    const entries: { month: string; metricKey: string; field: "budget"; value: number | null }[] = [];
    for (const metric of BUDGET_METRICS.filter((m) => m.section === section)) {
      for (const m of editableMonths) {
        if (m <= cur) continue; // only fill the future
        if (budgets[m]?.[metric.key] != null) continue; // don't overwrite a real budget
        const sug = suggestBudget(metric, m, suggestLookup);
        if (sug != null) entries.push({ month: m, metricKey: metric.key, field: "budget", value: sug });
      }
    }
    if (!entries.length) {
      setToast(`No suggestions for ${section}`);
      return;
    }
    batchSave(entries, `Accepted ${entries.length} · ${section}`);
  }

  // Auto-dismiss the bulk-edit toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ⌘Z / Ctrl+Z undoes the last bulk edit (only when not typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && lastBatch) {
        const tag = (document.activeElement?.tagName ?? "").toLowerCase();
        if (tag === "input" || tag === "textarea") return; // leave native undo while typing
        e.preventDefault();
        undoLast();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lastBatch]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Cash runway: project forward on actual burn (past/current) then budget
  //    burn (future). Cash on hand is a manual management figure (no ERP). ──
  const cur = data.currentMonth;
  const burnOf = (m: string): number => {
    const actual = financeActuals[m]?.monthly_burn;
    const budget = budgets[m]?.monthly_burn;
    return (m <= cur ? actual ?? budget : budget ?? actual) ?? 0;
  };
  const cashMonthsAvail = Object.keys(cashByMonth)
    .filter((m) => m <= cur)
    .sort();
  const cashMonth =
    cashMonthsAvail[cashMonthsAvail.length - 1] ??
    Object.keys(cashByMonth).sort().slice(-1)[0] ??
    cur;
  const startingCash = cashByMonth[cashMonth] ?? null;
  const burnByMonth: Record<string, number> = {};
  for (let i = 0, m = cashMonth; i < 25; i++, m = addMonths(m, 1)) {
    burnByMonth[m] = burnOf(m);
  }
  const cashSeries: CashPoint[] =
    startingCash != null ? projectCashRunway(startingCash, cashMonth, burnByMonth, 24) : [];
  let fwdBurnSum = 0;
  let fwdBurnN = 0;
  for (let i = 0, m = cashMonth; i < 12; i++, m = addMonths(m, 1)) {
    const b = burnOf(m);
    if (b > 0) {
      fwdBurnSum += b;
      fwdBurnN++;
    }
  }
  const runwayMonths =
    startingCash != null
      ? monthsOfRunway(startingCash, fwdBurnN ? fwdBurnSum / fwdBurnN : 0)
      : null;
  const cashZero = cashZeroMonth(cashSeries);

  // ── New-MRR plan vs forecast (predicted) over budgeted months ──
  const predictedNewMrr = forecastNewMrr.predicted ?? {};
  const reconcileMonths = Object.keys(predictedNewMrr).filter(
    (m) => budgets[m]?.target_new_mrr != null
  );
  const reconcile =
    reconcileMonths.length > 0
      ? reconcileNewMrr(
          Object.fromEntries(reconcileMonths.map((m) => [m, budgets[m]?.target_new_mrr ?? 0])),
          Object.fromEntries(reconcileMonths.map((m) => [m, predictedNewMrr[m]]))
        )
      : null;
  const forecastRefs: {
    id: ScenarioId;
    label: string;
    color: string;
    byMonth: Record<string, number>;
  }[] = (["predicted", "best", "worst"] as ScenarioId[])
    .filter((id) => forecastNewMrr[id] && Object.keys(forecastNewMrr[id]).length > 0)
    .map((id) => ({
      id,
      label: SCENARIO_META[id].label,
      color: SCENARIO_META[id].color,
      byMonth: forecastNewMrr[id],
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Budget</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Budget vs Actual · fiscal year 1 Aug – 31 Jul · grey = synced actual · ⌘D fill down · ⌘R fill right · paste a column
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)] min-w-[64px] text-right">
            {inFlight > 0 ? "Saving…" : savedAt ? "Saved ✓" : ""}
          </span>
          <button
            type="button"
            onClick={() => changeSuggest(!suggest)}
            title="Show suggested budgets from trailing actuals"
            className={`px-3 py-1 rounded-md border text-sm transition-colors ${
              suggest
                ? "bg-[var(--text-primary)] text-white border-[var(--text-primary)]"
                : "border-gray-200 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            ✦ Suggest
          </button>
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

      <RunwayPanel
        cashMonth={cashMonth}
        startingCash={startingCash}
        series={cashSeries}
        runwayMonths={runwayMonths}
        cashZero={cashZero}
        onSaveCash={saveCash}
      />

      {reconcile && reconcile.band !== "unknown" && (
        <div
          className={`flex items-center gap-2 flex-wrap rounded-lg border px-3 py-2 text-xs ${
            reconcile.band === "aligned"
              ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
              : reconcile.band === "ambitious"
                ? "border-blue-200 bg-blue-50/60 text-blue-700"
                : "border-amber-200 bg-amber-50/60 text-amber-700"
          }`}
        >
          <span className="font-medium">New-MRR plan vs forecast:</span>
          <span>{reconcile.message}</span>
          <a href="/forecast" className="underline underline-offset-2 hover:no-underline">
            view in Forecast →
          </a>
        </div>
      )}

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
                onFill={fillBudget}
                onPaste={pasteInto}
                suggest={suggest}
                suggestionFor={suggestionFor}
                onAcceptSection={acceptSuggestions}
                forecastRefs={forecastRefs}
                stickyCol={stickyCol}
                numCell={numCell}
                mode={mode}
                flashId={flashId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-30 flex items-center gap-3 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm text-white shadow-lg">
          <span>{toast}</span>
          {lastBatch && (
            <button
              type="button"
              onClick={undoLast}
              className="text-xs underline underline-offset-2 hover:no-underline"
            >
              Undo ⌘Z
            </button>
          )}
        </div>
      )}
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
  onFill,
  onPaste,
  suggest,
  suggestionFor,
  onAcceptSection,
  forecastRefs,
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
  onFill: (dir: "right" | "down", month: string, key: string, nativeValue: number | null) => void;
  onPaste: (month: string, key: string, field: "budget" | "actual", text: string) => boolean;
  suggest: boolean;
  suggestionFor: (metric: BudgetMetric, month: string) => number | null;
  onAcceptSection: (section: BudgetSection) => void;
  forecastRefs: ForecastRef[];
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
          {suggest && (
            <button
              type="button"
              onClick={() => onAcceptSection(section)}
              className="ml-3 normal-case text-[10px] font-medium text-emerald-700 underline underline-offset-2 hover:no-underline"
            >
              ✦ Accept all
            </button>
          )}
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
          onFill={onFill}
          onPaste={onPaste}
          suggest={suggest}
          suggestionFor={suggestionFor}
          forecastRefs={forecastRefs}
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
  onFill,
  onPaste,
  suggest,
  suggestionFor,
  forecastRefs,
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
  onFill: (dir: "right" | "down", month: string, key: string, nativeValue: number | null) => void;
  onPaste: (month: string, key: string, field: "budget" | "actual", text: string) => boolean;
  suggest: boolean;
  suggestionFor: (metric: BudgetMetric, month: string) => number | null;
  forecastRefs: ForecastRef[];
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
          const suggestion =
            suggest && p.kind === "month" && p.isFuture && val == null
              ? suggestionFor(metric, p.months[0])
              : null;
          return (
            <td key={p.key} className={`${numCell} ${colClasses(p.kind, p.isCurrent)}`}>
              {p.kind === "month" ? (
                <EditableCell
                  value={val}
                  metric={metric}
                  suggestion={suggestion}
                  onSave={(v) => onSave(p.months[0], metric.key, "budget", v)}
                  onFill={(dir, nv) => onFill(dir, p.months[0], metric.key, nv)}
                  onPasteText={(t) => onPaste(p.months[0], metric.key, "budget", t)}
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
                <EditableCell
                  value={val}
                  metric={metric}
                  muted
                  onSave={(v) => onSave(p.months[0], metric.key, "actual", v)}
                  onPasteText={(t) => onPaste(p.months[0], metric.key, "actual", t)}
                />
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
      {metric.key === "target_new_mrr" &&
        forecastRefs.map((ref) => (
          <tr key={ref.id}>
            <td className={`${stickyCol} px-3`}>
              <div className="text-[10px] pl-2" style={{ color: ref.color }}>
                forecast · {ref.label}
              </div>
            </td>
            {periods.map((p) => {
              const v =
                p.kind === "month"
                  ? ref.byMonth[p.months[0]] ?? null
                  : rollupValues(
                      p.months.map((m) => ref.byMonth[m] ?? null),
                      "sum"
                    );
              return (
                <td
                  key={p.key}
                  className={`${numCell} ${colClasses(p.kind, p.isCurrent)}`}
                  style={{ color: ref.color }}
                >
                  {v != null ? formatValue(v, metric) : "—"}
                </td>
              );
            })}
          </tr>
        ))}
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
  onFill,
  onPasteText,
  suggestion,
}: {
  value: number | null;
  metric: BudgetMetric;
  onSave: (v: number | null) => void;
  muted?: boolean;
  onFill?: (dir: "right" | "down", nativeValue: number | null) => void;
  onPasteText?: (text: string) => boolean;
  suggestion?: number | null;
}) {
  const display = toDisplayNumber(value, metric);
  const hasSuggestion = value == null && suggestion != null;
  return (
    <input
      // Remount when the underlying value changes externally (reload / prefill /
      // future fill-down) so the uncontrolled input never shows stale text — and
      // no per-cell state/effects, so it can't re-introduce the render freeze.
      key={display || (hasSuggestion ? `s${suggestion}` : "")}
      type="text"
      inputMode="decimal"
      defaultValue={display}
      onFocus={(e) => {
        if (hasSuggestion && e.target.value === "") {
          e.target.value = toDisplayNumber(suggestion ?? null, metric);
        }
        e.target.select();
      }}
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
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
          return;
        }
        if ((e.metaKey || e.ctrlKey) && onFill && (e.key === "d" || e.key === "D")) {
          e.preventDefault();
          onFill("down", fromDisplayNumber((e.target as HTMLInputElement).value, metric));
        } else if ((e.metaKey || e.ctrlKey) && onFill && (e.key === "r" || e.key === "R")) {
          e.preventDefault();
          onFill("right", fromDisplayNumber((e.target as HTMLInputElement).value, metric));
        }
      }}
      onPaste={
        onPasteText
          ? (e) => {
              const text = e.clipboardData.getData("text");
              if (text && onPasteText(text)) e.preventDefault();
            }
          : undefined
      }
      placeholder={hasSuggestion ? `≈${toDisplayNumber(suggestion ?? null, metric)}` : "—"}
      aria-label={`${metric.label} ${muted ? "actual" : "budget"}`}
      className={`w-[72px] bg-transparent text-right tabular-nums rounded px-1 border border-transparent hover:border-gray-300 hover:bg-gray-50 focus:bg-white focus:border-[var(--text-primary)]/40 focus:outline-none ${
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      } ${
        hasSuggestion
          ? "placeholder:text-emerald-600/60 placeholder:italic"
          : "placeholder:text-gray-300"
      }`}
    />
  );
}


/**
 * Runway: cash on hand (a manual management figure — no ERP feed), months of
 * runway colour-graded (green >12 · amber 6–12 · red <6), the cash-zero month,
 * and a sparkline of the projected balance dipping past its zero line.
 */
function RunwayPanel({
  cashMonth,
  startingCash,
  series,
  runwayMonths,
  cashZero,
  onSaveCash,
}: {
  cashMonth: string;
  startingCash: number | null;
  series: CashPoint[];
  runwayMonths: number | null;
  cashZero: string | null;
  onSaveCash: (native: number | null) => void;
}) {
  const display = startingCash != null ? String(Math.round(startingCash / 100)) : "";
  const grade =
    runwayMonths == null
      ? "text-[var(--text-muted)]"
      : runwayMonths >= 12
        ? "text-emerald-600"
        : runwayMonths >= 6
          ? "text-amber-600"
          : "text-red-600";
  return (
    <div className="flex items-center gap-6 flex-wrap rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Cash on hand</span>
        <div className="flex items-baseline gap-1">
          <input
            key={display}
            type="text"
            inputMode="decimal"
            defaultValue={display}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              const t = e.target.value.trim().replace(/\s/g, "").replace(",", ".");
              if (t !== "" && Number.isNaN(Number(t))) {
                e.target.value = display; // revert invalid
                return;
              }
              const native = t === "" ? null : Math.round(Number(t) * 100);
              if (native !== startingCash) onSaveCash(native);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            placeholder="—"
            aria-label="Cash on hand (kr)"
            className="w-[120px] bg-transparent text-lg font-semibold tabular-nums text-[var(--text-primary)] rounded px-1 border border-transparent hover:border-gray-300 focus:bg-white focus:border-[var(--text-primary)]/40 focus:outline-none placeholder:text-gray-300"
          />
          <span className="text-xs text-[var(--text-muted)]">kr</span>
        </div>
        <span className="text-[10px] text-gray-400">as of {monthLabel(cashMonth)}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Runway</span>
        <span className={`text-2xl font-semibold ${grade}`}>
          {startingCash == null ? "—" : runwayMonths == null ? "∞" : `${runwayMonths} mo`}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">Cash-zero</span>
        <span className="text-sm text-[var(--text-primary)]">
          {startingCash == null ? "—" : cashZero ? monthLabel(cashZero) : "beyond horizon ✓"}
        </span>
      </div>
      <div className="flex-1 min-w-[200px]">
        <CashSparkline series={series} zeroMonth={cashZero} />
      </div>
    </div>
  );
}

/** Sparkline of the projected cash balance, with a zero baseline + cash-zero dot. */
function CashSparkline({ series, zeroMonth }: { series: CashPoint[]; zeroMonth: string | null }) {
  if (series.length < 2) {
    return <div className="text-[10px] text-gray-400">enter cash on hand to project runway</div>;
  }
  const w = 240;
  const h = 40;
  const pad = 3;
  const vals = series.map((p) => p.cash);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / range) * (h - 2 * pad);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.cash).toFixed(1)}`).join(" ");
  const zeroY = y(0);
  const zeroIdx = zeroMonth ? series.findIndex((p) => p.month === zeroMonth) : -1;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="#e5e7eb" strokeWidth={1} />
      <polyline
        points={pts}
        fill="none"
        stroke="#1A5C5A"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {zeroIdx >= 0 && (
        <circle cx={x(zeroIdx)} cy={y(series[zeroIdx].cash)} r={2.5} fill="#ef4444" />
      )}
    </svg>
  );
}
