"use client";

import type { Currency } from "@/lib/currency";

interface CurrencyToggleProps {
  value: Currency;
  onChange: (currency: Currency) => void;
}

const currencies: Currency[] = ["DKK", "EUR", "USD"];

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {currencies.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === c
              ? "bg-[var(--accent-blue)] text-white"
              : "bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
