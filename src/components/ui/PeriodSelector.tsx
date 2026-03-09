"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import type { PeriodDescriptor } from "@/lib/types/period";
import { generatePeriodOptions, monthPeriod } from "@/lib/period";

interface PeriodSelectorProps {
  /** Currently selected period */
  value: PeriodDescriptor;
  /** Called when the user selects a new period */
  onChange: (period: PeriodDescriptor) => void;
}

/**
 * Grouped period dropdown with Months, Trailing, Quarters, and Years.
 * Uses a custom dropdown for full styling control instead of <select>.
 */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = useMemo(() => generatePeriodOptions(), []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const select = (period: PeriodDescriptor) => {
    onChange(period);
    setOpen(false);
  };

  const isSelected = (p: PeriodDescriptor) =>
    p.startMonth === value.startMonth && p.endMonth === value.endMonth;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
      >
        <span>{value.label}</span>
        <svg
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[calc(100vw-2rem)] sm:w-64 max-h-[70vh] sm:max-h-80 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-lg">
          <OptionGroup
            label="Trailing"
            items={options.trailing}
            isSelected={isSelected}
            onSelect={select}
          />
          <OptionGroup
            label="Months"
            items={options.months}
            isSelected={isSelected}
            onSelect={select}
          />
          <OptionGroup
            label="Quarters"
            items={options.quarters}
            isSelected={isSelected}
            onSelect={select}
          />
          <OptionGroup
            label="Years"
            items={options.years}
            isSelected={isSelected}
            onSelect={select}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal grouped section
// ---------------------------------------------------------------------------

function OptionGroup({
  label,
  items,
  isSelected,
  onSelect,
}: {
  label: string;
  items: PeriodDescriptor[];
  isSelected: (p: PeriodDescriptor) => boolean;
  onSelect: (p: PeriodDescriptor) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-b-0">
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      {items.map((item) => (
        <button
          key={`${item.startMonth}-${item.endMonth}`}
          onClick={() => onSelect(item)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
            isSelected(item)
              ? "bg-[var(--accent-coral)]/10 text-[var(--accent-coral)] font-medium"
              : "text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// Re-export for convenience
export { monthPeriod };
