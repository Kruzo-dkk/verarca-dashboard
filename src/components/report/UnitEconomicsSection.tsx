"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import type { ReportData } from "@/lib/types/report";

interface UnitEconomicsSectionProps {
  data: ReportData;
  formatValue: (v: number) => string;
}

export function UnitEconomicsSection({ data, formatValue }: UnitEconomicsSectionProps) {
  const ue = data.unitEconomics;

  const cards = [
    {
      label: "Customer LTV",
      value: ue.ltv !== null ? formatValue(ue.ltv) : null,
      available: ue.ltv !== null,
    },
    {
      label: "Revenue / Employee",
      value: ue.revenuePerEmployee !== null ? formatValue(ue.revenuePerEmployee) : null,
      subtitle: ue.employeeCount !== null ? `${ue.employeeCount} employees` : undefined,
      available: ue.revenuePerEmployee !== null,
    },
    {
      label: "CAC",
      value: null,
      available: false,
      stub: "Requires accounting integration",
    },
    {
      label: "LTV/CAC Ratio",
      value: null,
      available: false,
      stub: "Requires accounting integration",
    },
    {
      label: "Gross Margin",
      value: null,
      available: false,
      stub: "Requires accounting integration",
    },
    {
      label: "Rule of 40",
      value: null,
      available: false,
      stub: "Requires accounting integration",
    },
  ];

  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Unit Economics</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <GlassCard key={card.label} className={`text-center ${!card.available ? "opacity-50" : ""}`}>
            <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
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
