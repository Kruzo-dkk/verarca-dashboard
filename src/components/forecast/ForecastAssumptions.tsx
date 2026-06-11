"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ScenarioAssumptionMeta } from "@/lib/forecast";
import { SCENARIO_ORDER, SCENARIO_META, type ScenarioId } from "@/lib/forecast-scenarios";

interface ForecastAssumptionsProps {
  assumptions: ScenarioAssumptionMeta[];
  formatValue: (v: number) => string;
  onSave: (updated: ScenarioAssumptionMeta) => Promise<void>;
  onReset: (scenario: ScenarioId) => Promise<void>;
}

type FieldKey = "monthlyChurnPct" | "monthlyExpansionPct" | "newLogosPerMonth" | "avgNewDealSize" | "pipelineConversionPct";

const FIELDS: {
  key: FieldKey;
  label: string;
  suffix: string;
  step: string;
  min: number;
  max?: number;
  format?: "currency";
  hint?: string;
}[] = [
  { key: "monthlyChurnPct", label: "Monthly Churn", suffix: "%", step: "0.1", min: 0, max: 100 },
  { key: "monthlyExpansionPct", label: "Monthly Expansion", suffix: "%", step: "0.1", min: 0, max: 100 },
  { key: "newLogosPerMonth", label: "New Logos / Month", suffix: "", step: "1", min: 0 },
  {
    key: "avgNewDealSize",
    label: "Avg new-deal MRR",
    suffix: "",
    step: "1",
    min: 0,
    format: "currency",
    hint: "Average MRR of a new deal over the window = new MRR ÷ new logos. New-business economics — distinct from blended ARPA; new deals typically land below ARPA and expand over time.",
  },
  { key: "pipelineConversionPct", label: "Pipeline Conversion", suffix: "%", step: "1", min: 0, max: 100 },
];

// Display string for a read-only (predicted) cell.
function readonlyText(key: FieldKey, format: "currency" | undefined, rawValue: number): string {
  if (format === "currency") return `kr ${Math.round(rawValue / 100).toLocaleString("da-DK")}`;
  if (key === "newLogosPerMonth") return rawValue.toFixed(1);
  return `${rawValue.toFixed(1)}%`;
}

// Editable input string for a band cell (currency shown in kroner).
function inputValue(format: "currency" | undefined, rawValue: number): string {
  return format === "currency" ? (rawValue / 100).toString() : rawValue.toString();
}

export function ForecastAssumptions({ assumptions, formatValue, onSave, onReset }: ForecastAssumptionsProps) {
  const [local, setLocal] = useState<ScenarioAssumptionMeta[]>(assumptions);
  const [savingScenario, setSavingScenario] = useState<string | null>(null);
  const [resettingScenario, setResettingScenario] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, "saved" | "error" | null>>({});

  // Re-sync local state only when the assumption VALUES change — not on every
  // refetch. Changing Horizon (a chart-only control) refetches and returns
  // identical assumptions, so keying the resync on a value signature instead of
  // the array reference preserves in-progress, unsaved band edits.
  const assumptionsSignature = useMemo(
    () =>
      assumptions
        .map(
          (a) =>
            `${a.scenario}:${a.isCustom}:${a.monthlyChurnPct}:${a.monthlyExpansionPct}:${a.newLogosPerMonth}:${a.avgNewDealSize}:${a.pipelineConversionPct}`
        )
        .join("|"),
    [assumptions]
  );
  useEffect(() => {
    setLocal(assumptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assumptionsSignature]);

  const handleChange = useCallback(
    (scenario: string, key: FieldKey, value: string) => {
      setLocal((prev) =>
        prev.map((a) => (a.scenario === scenario ? { ...a, [key]: parseFloat(value) || 0 } : a))
      );
      setSaveStatus((prev) => ({ ...prev, [scenario]: null }));
    },
    []
  );

  const handleSave = useCallback(
    async (scenario: string) => {
      const row = local.find((a) => a.scenario === scenario);
      if (!row) return;

      setSavingScenario(scenario);
      try {
        await onSave(row);
        setSaveStatus((prev) => ({ ...prev, [scenario]: "saved" }));
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [scenario]: null }));
        }, 2000);
      } catch {
        setSaveStatus((prev) => ({ ...prev, [scenario]: "error" }));
      }
      setSavingScenario(null);
    },
    [local, onSave]
  );

  const handleReset = useCallback(
    async (scenario: ScenarioId) => {
      setResettingScenario(scenario);
      try {
        await onReset(scenario);
      } catch {
        setSaveStatus((prev) => ({ ...prev, [scenario]: "error" }));
      }
      setResettingScenario(null);
    },
    [onReset]
  );

  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
        Forecast Assumptions
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        <span className="font-medium text-[var(--text-secondary)]">Predicted</span> is computed
        automatically from your trailing actuals and updates as new months land. Worst, Better, and
        Best are suggested around it — adjust any of them to model your own bands.
      </p>

      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)]">
              <th className="pb-3 font-medium w-40">Metric</th>
              {SCENARIO_ORDER.map((s) => {
                const meta = SCENARIO_META[s];
                return (
                  <th key={s} className="pb-3 font-medium text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                      {meta.readOnly && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 px-1 py-0.5 rounded">
                          Auto
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((field) => (
              <tr key={field.key} className="border-t border-[var(--border-subtle)]">
                <td className="py-2.5 text-[var(--text-secondary)]">
                  {field.label}
                  {field.suffix === "%" && (
                    <span className="text-[var(--text-muted)] ml-0.5 text-xs"> (%)</span>
                  )}
                  {field.hint && (
                    <span className="ml-1 text-[var(--text-muted)] cursor-help" title={field.hint}>
                      ⓘ
                    </span>
                  )}
                </td>
                {SCENARIO_ORDER.map((s) => {
                  const row = local.find((a) => a.scenario === s);
                  const rawValue = row ? row[field.key] : 0;

                  if (row?.readOnly) {
                    return (
                      <td key={s} className="py-2.5 text-center text-[var(--text-primary)] font-medium">
                        {readonlyText(field.key, field.format, rawValue)}
                      </td>
                    );
                  }

                  return (
                    <td key={s} className="py-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        {field.format === "currency" && (
                          <span className="text-xs text-[var(--text-muted)]">kr</span>
                        )}
                        <input
                          type="number"
                          value={inputValue(field.format, rawValue)}
                          step={field.step}
                          min={field.min}
                          max={field.max}
                          onChange={(e) => {
                            const val =
                              field.format === "currency"
                                ? (parseFloat(e.target.value) * 100).toString()
                                : e.target.value;
                            handleChange(s, field.key, val);
                          }}
                          className="w-20 px-2 py-1 text-sm text-center bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                        />
                        {field.suffix === "%" && (
                          <span className="text-xs text-[var(--text-muted)]">%</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Action row */}
            <tr className="border-t border-[var(--border-subtle)]">
              <td className="py-3" />
              {SCENARIO_ORDER.map((s) => {
                const row = local.find((a) => a.scenario === s);
                if (row?.readOnly) {
                  return (
                    <td key={s} className="py-3 text-center align-top">
                      <span className="text-[10px] text-[var(--text-muted)]">Auto-updated</span>
                    </td>
                  );
                }
                return (
                  <td key={s} className="py-3 text-center align-top">
                    <button
                      onClick={() => handleSave(s)}
                      disabled={savingScenario === s}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {savingScenario === s ? "Saving..." : "Save"}
                    </button>
                    {saveStatus[s] === "saved" && (
                      <span className="block text-[10px] text-emerald-600 mt-1">Saved ✓</span>
                    )}
                    {saveStatus[s] === "error" && (
                      <span className="block text-[10px] text-red-600 mt-1">Error</span>
                    )}
                    <div className="mt-1.5">{renderBandStatus(row, s, resettingScenario, handleReset)}</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden space-y-4">
        {SCENARIO_ORDER.map((s) => {
          const meta = SCENARIO_META[s];
          const row = local.find((a) => a.scenario === s);
          if (!row || !meta) return null;

          return (
            <div
              key={s}
              className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {meta.label}
                </span>
                {meta.readOnly ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 px-1.5 py-0.5 rounded">
                    Auto
                  </span>
                ) : (
                  <span className="ml-auto">{renderBandStatus(row, s, resettingScenario, handleReset)}</span>
                )}
              </div>

              <div className="space-y-2.5">
                {FIELDS.map((field) => {
                  const rawValue = row[field.key];

                  return (
                    <div key={field.key} className="flex items-center justify-between gap-3">
                      <label className="text-xs text-[var(--text-muted)] shrink-0" title={field.hint}>
                        {field.label}
                        {field.hint && <span className="ml-1 cursor-help">ⓘ</span>}
                      </label>
                      {row.readOnly ? (
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {readonlyText(field.key, field.format, rawValue)}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1">
                          {field.format === "currency" && (
                            <span className="text-xs text-[var(--text-muted)]">kr</span>
                          )}
                          <input
                            type="number"
                            value={inputValue(field.format, rawValue)}
                            step={field.step}
                            min={field.min}
                            max={field.max}
                            onChange={(e) => {
                              const val =
                                field.format === "currency"
                                  ? (parseFloat(e.target.value) * 100).toString()
                                  : e.target.value;
                              handleChange(s, field.key, val);
                            }}
                            className="w-24 px-2 py-1.5 text-sm text-right bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                          />
                          {field.suffix === "%" && (
                            <span className="text-xs text-[var(--text-muted)]">%</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!row.readOnly && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={() => handleSave(s)}
                    disabled={savingScenario === s}
                    className="px-4 py-2 text-xs font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingScenario === s ? "Saving..." : "Save"}
                  </button>
                  {saveStatus[s] === "saved" && (
                    <span className="text-[10px] text-emerald-600">Saved ✓</span>
                  )}
                  {saveStatus[s] === "error" && (
                    <span className="text-[10px] text-red-600">Error</span>
                  )}
                </div>
              )}
              {row.readOnly && (
                <p className="text-[10px] text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  Auto-updated from your trailing actuals.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// Suggested vs Custom indicator (+ reset link) for an editable band.
function renderBandStatus(
  row: ScenarioAssumptionMeta | undefined,
  scenario: ScenarioId,
  resetting: string | null,
  onReset: (scenario: ScenarioId) => void
) {
  if (!row) return null;
  if (!row.isCustom) {
    return (
      <span className="text-[10px] text-[var(--text-muted)]">Suggested</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-medium text-[var(--accent-teal)]">Custom</span>
      <span className="text-[var(--text-muted)] text-[10px]">·</span>
      <button
        onClick={() => onReset(scenario)}
        disabled={resetting === scenario}
        className="text-[10px] text-[var(--text-muted)] underline hover:text-[var(--text-secondary)] disabled:opacity-50"
      >
        {resetting === scenario ? "Resetting…" : "Reset to suggested"}
      </button>
    </span>
  );
}
