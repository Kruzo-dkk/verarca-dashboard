"use client";

import { useState, type ReactNode } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricKey } from "@/lib/tooltip-registry";
import type { ReportData } from "@/lib/types/report";
import { calculateLTV, calculateTrailingLogoChurnRate } from "@/lib/metrics";

interface UnitEconomicsSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

const LTV_WINDOW_OPTIONS = [3, 6, 12];

export function UnitEconomicsSection({ data, formatValue }: UnitEconomicsSectionProps) {
  const ue = data.unitEconomics;

  // Customer LTV is recomputed from a user-selectable trailing churn window,
  // client-side, using the same pure helpers as the server (no re-fetch). The
  // default matches the server-computed value, so initial render is consistent.
  const [ltvMonths, setLtvMonths] = useState(ue.ltvChurnBasisMonths || 12);

  const churnWindow = (ue.ltvChurnHistory ?? []).slice(-ltvMonths);
  const monthsCovered = churnWindow.length;
  const trailingChurn = calculateTrailingLogoChurnRate(churnWindow);
  const ltvAvailable = ue.ltvArpaOre > 0 && monthsCovered > 0;
  const ltv = ltvAvailable
    ? calculateLTV(ue.ltvArpaOre, trailingChurn, ue.grossMargin)
    : null;
  const ltvCac =
    ltv !== null && ue.cac !== null && ue.cac > 0
      ? Math.round((ltv / ue.cac) * 100) / 100
      : null;

  const ltvSubtitle =
    ltv === null
      ? undefined
      : trailingChurn <= 0
        ? `60-mo cap · no churn in ${monthsCovered}mo`
        : `${monthsCovered}-mo churn ${trailingChurn.toFixed(2)}%${
            ue.grossMargin !== null ? ` · GM ${ue.grossMargin.toFixed(0)}%` : ""
          }`;

  const ltvControl: ReactNode = ltvAvailable ? (
    <div
      className="flex items-center justify-center gap-1 mt-2"
      role="group"
      aria-label="LTV trailing churn window"
    >
      {LTV_WINDOW_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setLtvMonths(m)}
          aria-pressed={ltvMonths === m}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            ltvMonths === m
              ? "border-[var(--text-muted)] text-[var(--text-primary)] bg-[var(--text-primary)]/5"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {m}mo
        </button>
      ))}
    </div>
  ) : undefined;

  const cards: {
    label: string;
    metric: MetricKey;
    value: string | null;
    available: boolean;
    subtitle?: string;
    stub?: string;
    control?: ReactNode;
  }[] = [
    {
      label: "Customer LTV",
      metric: "ltv",
      value: ltv !== null ? formatValue(ltv) : null,
      available: ltv !== null,
      subtitle: ltvSubtitle,
      control: ltvControl,
    },
    {
      label: "Revenue / Employee",
      metric: "revenuePerEmployee",
      value: ue.revenuePerEmployee !== null ? formatValue(ue.revenuePerEmployee) : null,
      subtitle: ue.employeeCount !== null ? `${ue.employeeCount} employees` : undefined,
      available: ue.revenuePerEmployee !== null,
    },
    {
      label: "CAC",
      metric: "cac",
      value: ue.cac !== null ? formatValue(ue.cac) : null,
      available: ue.cac !== null,
      stub: ue.cac === null ? "Configure in Settings" : undefined,
    },
    {
      label: "LTV/CAC Ratio",
      metric: "ltvCacRatio",
      value: ltvCac !== null ? `${ltvCac.toFixed(1)}x` : null,
      available: ltvCac !== null,
      subtitle: ltvCac !== null
        ? ltvCac >= 3 ? "Healthy" : ltvCac >= 1 ? "Monitor" : "Below target"
        : undefined,
      stub: ltvCac === null ? "Configure in Settings" : undefined,
    },
    {
      label: "Gross Margin",
      metric: "grossMargin",
      value: ue.grossMargin !== null ? `${ue.grossMargin.toFixed(1)}%` : null,
      available: ue.grossMargin !== null,
      stub: ue.grossMargin === null ? "Enter COGS in Settings" : undefined,
    },
    {
      label: "Rule of 40",
      metric: "ruleOf40",
      value: ue.ruleOf40 !== null ? ue.ruleOf40.toFixed(1) : null,
      available: ue.ruleOf40 !== null,
      subtitle: ue.ruleOf40 !== null
        ? ue.ruleOf40 >= 40 ? "Above target" : ue.ruleOf40 >= 30 ? "Approaching" : "Below target"
        : undefined,
      stub: ue.ruleOf40 === null ? "Enter COGS in Settings" : undefined,
    },
  ];

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Unit Economics</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <GlassCard key={card.label} className={`text-center ${!card.available ? "opacity-50" : ""}`}>
            <MetricTooltip metric={card.metric}>
              <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
            </MetricTooltip>
            <div className="metric-value text-xl mt-2 text-[var(--text-primary)]">
              {card.value ?? "—"}
            </div>
            {card.subtitle && (
              <span className="text-[10px] text-[var(--text-muted)] block mt-1">{card.subtitle}</span>
            )}
            {card.stub && (
              <span className="text-[10px] text-[var(--text-muted)] block mt-1 italic">{card.stub}</span>
            )}
            {card.control}
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
