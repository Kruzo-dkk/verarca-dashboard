"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import type { MetricKey } from "@/lib/tooltip-registry";
import type { ReportData } from "@/lib/types/report";

interface UnitEconomicsSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function UnitEconomicsSection({ data, formatValue }: UnitEconomicsSectionProps) {
  const ue = data.unitEconomics;

  const cards: {
    label: string;
    metric: MetricKey;
    value: string | null;
    available: boolean;
    subtitle?: string;
    stub?: string;
  }[] = [
    {
      label: "Customer LTV",
      metric: "ltv",
      value: ue.ltv !== null ? formatValue(ue.ltv) : null,
      available: ue.ltv !== null,
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
      value: ue.ltvCacRatio !== null ? `${ue.ltvCacRatio.toFixed(1)}x` : null,
      available: ue.ltvCacRatio !== null,
      subtitle: ue.ltvCacRatio !== null
        ? ue.ltvCacRatio >= 3 ? "Healthy" : ue.ltvCacRatio >= 1 ? "Monitor" : "Below target"
        : undefined,
      stub: ue.ltvCacRatio === null ? "Configure in Settings" : undefined,
    },
    {
      label: "Gross Margin",
      metric: "grossMargin",
      value: null,
      available: false,
      stub: "Not yet integrated",
    },
    {
      label: "Rule of 40",
      metric: "ruleOf40",
      value: null,
      available: false,
      stub: "Not yet integrated",
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
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
