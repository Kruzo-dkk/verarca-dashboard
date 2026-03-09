"use client";

import { useState, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { ForecastAssumptions as AssumptionsType } from "@/lib/forecast";

interface ForecastAssumptionsProps {
  assumptions: AssumptionsType[];
  formatValue: (v: number) => string;
  onSave: (updated: AssumptionsType) => Promise<void>;
}

const SCENARIO_META: Record<string, { label: string; color: string }> = {
  best: { label: "Best", color: "#10b981" },
  base: { label: "Base", color: "#1A5C5A" },
  worst: { label: "Worst", color: "#ef4444" },
};

const FIELDS: {
  key: keyof Omit<AssumptionsType, "scenario">;
  label: string;
  suffix: string;
  step: string;
  min: number;
  max?: number;
  format?: "currency";
}[] = [
  { key: "monthlyChurnPct", label: "Monthly Churn", suffix: "%", step: "0.1", min: 0, max: 100 },
  { key: "monthlyExpansionPct", label: "Monthly Expansion", suffix: "%", step: "0.1", min: 0, max: 100 },
  { key: "newLogosPerMonth", label: "New Logos / Month", suffix: "", step: "1", min: 0 },
  { key: "avgNewDealSize", label: "Avg Deal Size", suffix: "", step: "1", min: 0, format: "currency" },
  { key: "pipelineConversionPct", label: "Pipeline Conversion", suffix: "%", step: "1", min: 0, max: 100 },
];

export function ForecastAssumptions({ assumptions, formatValue, onSave }: ForecastAssumptionsProps) {
  const [local, setLocal] = useState<AssumptionsType[]>(assumptions);
  const [savingScenario, setSavingScenario] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<Record<string, "saved" | "error" | null>>({});

  // Keep local in sync if parent data changes
  // (initial load — subsequent edits are local-first)

  const handleChange = useCallback(
    (scenario: string, key: keyof Omit<AssumptionsType, "scenario">, value: string) => {
      setLocal((prev) =>
        prev.map((a) =>
          a.scenario === scenario ? { ...a, [key]: parseFloat(value) || 0 } : a
        )
      );
      // Clear any previous save status
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

  const scenarioOrder = ["best", "base", "worst"];

  return (
    <GlassCard>
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
        Forecast Assumptions
      </h2>
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Adjust scenario parameters to see how different growth and churn assumptions affect your MRR forecast.
      </p>

      {/* Desktop: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-muted)]">
              <th className="pb-3 font-medium w-40">Metric</th>
              {scenarioOrder.map((s) => {
                const meta = SCENARIO_META[s];
                return (
                  <th key={s} className="pb-3 font-medium text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: meta?.color }}
                      />
                      {meta?.label}
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
                  {field.suffix && (
                    <span className="text-[var(--text-muted)] ml-0.5 text-xs">
                      {field.suffix === "%" ? " (%)" : ""}
                    </span>
                  )}
                </td>
                {scenarioOrder.map((s) => {
                  const row = local.find((a) => a.scenario === s);
                  const rawValue = row ? row[field.key] : 0;
                  const displayValue =
                    field.format === "currency"
                      ? (rawValue / 100).toString() // øre → kroner for display
                      : rawValue.toString();

                  return (
                    <td key={s} className="py-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        {field.format === "currency" && (
                          <span className="text-xs text-[var(--text-muted)]">kr</span>
                        )}
                        <input
                          type="number"
                          value={displayValue}
                          step={field.step}
                          min={field.min}
                          max={field.max}
                          onChange={(e) => {
                            const val =
                              field.format === "currency"
                                ? (parseFloat(e.target.value) * 100).toString() // kroner → øre
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

            {/* Save buttons row */}
            <tr className="border-t border-[var(--border-subtle)]">
              <td className="py-3" />
              {scenarioOrder.map((s) => (
                <td key={s} className="py-3 text-center">
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
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: card layout */}
      <div className="md:hidden space-y-4">
        {scenarioOrder.map((s) => {
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
                  {meta.label} Case
                </span>
              </div>

              <div className="space-y-2.5">
                {FIELDS.map((field) => {
                  const rawValue = row[field.key];
                  const displayValue =
                    field.format === "currency"
                      ? (rawValue / 100).toString()
                      : rawValue.toString();

                  return (
                    <div key={field.key} className="flex items-center justify-between gap-3">
                      <label className="text-xs text-[var(--text-muted)] shrink-0">
                        {field.label}
                      </label>
                      <div className="flex items-center gap-1">
                        {field.format === "currency" && (
                          <span className="text-xs text-[var(--text-muted)]">kr</span>
                        )}
                        <input
                          type="number"
                          value={displayValue}
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
                          className="w-20 px-2 py-1 text-sm text-right bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
                        />
                        {field.suffix === "%" && (
                          <span className="text-xs text-[var(--text-muted)]">%</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => handleSave(s)}
                  disabled={savingScenario === s}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--accent-teal)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
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
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
