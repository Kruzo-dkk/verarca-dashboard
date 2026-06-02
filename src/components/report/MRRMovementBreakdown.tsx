"use client";

import { useState } from "react";
import { CustomerTable } from "./CustomerTable";
import type { CustomerSummary } from "@/lib/types/report";

interface MRRMovement {
  newCustomers: CustomerSummary[];
  expansion: CustomerSummary[];
  contraction: CustomerSummary[];
  churned: CustomerSummary[];
}

interface MRRMovementBreakdownProps {
  movement: MRRMovement;
  formatValue: (v: number) => string;
}

type TabKey = "new" | "expansion" | "contraction" | "churned";

const TABS: { key: TabKey; label: string; sign: "+" | "-"; color: string }[] = [
  { key: "new", label: "New", sign: "+", color: "text-emerald-600" },
  { key: "expansion", label: "Expansion", sign: "+", color: "text-emerald-600" },
  { key: "contraction", label: "Contraction", sign: "-", color: "text-amber-600" },
  { key: "churned", label: "Churned", sign: "-", color: "text-red-600" },
];

export function MRRMovementBreakdown({ movement, formatValue }: MRRMovementBreakdownProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("new");

  const lists: Record<TabKey, CustomerSummary[]> = {
    new: movement.newCustomers,
    expansion: movement.expansion,
    contraction: movement.contraction,
    churned: movement.churned,
  };
  const total = (rows: CustomerSummary[]) => rows.reduce((s, c) => s + c.mrr, 0);
  const active = lists[activeTab];
  const activeMeta = TABS.find((t) => t.key === activeTab)!;

  return (
    <div>
      {/* Tab bar — each tab shows its customer count and total movement */}
      <div className="flex flex-wrap gap-1 mb-4 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit">
        {TABS.map((tab) => {
          const rows = lists[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[11px] ${tab.color}`}>
                {rows.length === 0 ? "0" : `${tab.sign}${formatValue(total(rows))}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-2">
        {active.length} customer{active.length !== 1 ? "s" : ""} ·{" "}
        <span className={activeMeta.color}>
          {activeMeta.sign}
          {formatValue(total(active))}
        </span>{" "}
        MRR — click a row for detail
      </p>

      <div className="overflow-x-auto">
        <CustomerTable
          customers={active}
          formatValue={formatValue}
          expandable
          emptyMessage={`No ${activeMeta.label.toLowerCase()} this period`}
        />
      </div>
    </div>
  );
}
