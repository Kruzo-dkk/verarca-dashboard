"use client";

interface PeriodSelectorProps {
  value: string; // YYYY-MM
  onChange: (month: string) => void;
  months?: string[]; // available months
}

export function PeriodSelector({ value, onChange, months }: PeriodSelectorProps) {
  // Generate last 24 months if no months provided
  const options = months ?? generateMonths(24);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-blue)] cursor-pointer"
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {formatMonth(m)}
        </option>
      ))}
    </select>
  );
}

function generateMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
