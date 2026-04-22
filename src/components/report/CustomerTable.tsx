"use client";

import type { CustomerSummary } from "@/lib/types/report";

interface CustomerTableProps {
  customers: CustomerSummary[];
  formatValue: (v: number) => string;
  showChurnDate?: boolean;
  emptyMessage: string;
}

export function CustomerTable({
  customers,
  formatValue,
  showChurnDate,
  emptyMessage,
}: CustomerTableProps) {
  if (customers.length === 0) {
    return <p className="py-4 text-center text-[var(--text-muted)] text-sm">{emptyMessage}</p>;
  }

  return (
    <table className="w-full text-sm table-fixed">
      <colgroup>
        <col style={{ width: "35%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "25%" }} />
        <col style={{ width: "15%" }} />
        <col style={{ width: "10%" }} />
      </colgroup>
      <thead>
        <tr className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider">
          <th className="pb-2 font-medium">Customer</th>
          <th className="pb-2 font-medium text-right pr-4">MRR</th>
          <th className="pb-2 font-medium hidden sm:table-cell pl-4">Scope</th>
          <th className="pb-2 font-medium hidden md:table-cell">Partner</th>
          {showChurnDate ? (
            <th className="pb-2 font-medium">Closed</th>
          ) : (
            <th className="pb-2 font-medium hidden sm:table-cell">Status</th>
          )}
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c.id} className="border-t border-[var(--border-subtle)]">
            <td className="py-1.5 text-[var(--text-primary)] font-medium truncate">
              <div className="truncate">
                {c.name}
                {showChurnDate && c.mrr === 0 && (
                  <span
                    className="ml-1.5 text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full align-middle"
                    title="Churned before first invoice — affects logo churn, not revenue churn"
                  >
                    kr 0
                  </span>
                )}
                {c.scope && (
                  <span className="text-[11px] text-[var(--text-muted)] font-normal sm:hidden block truncate">
                    {c.scope}
                    {c.tier && c.tier !== "Standard" && (
                      <span className="ml-1 text-[10px] text-purple-500 font-medium">{c.tier}</span>
                    )}
                  </span>
                )}
              </div>
            </td>
            <td className="py-1.5 text-right metric-value pr-4 tabular-nums">{formatValue(c.mrr)}</td>
            <td className="py-1.5 text-[var(--text-secondary)] hidden sm:table-cell pl-4 truncate">
              <span>{c.scope ?? "—"}</span>
              {c.tier && c.tier !== "Standard" && (
                <span className="ml-1.5 text-[10px] font-medium text-purple-500 bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                  {c.tier}
                </span>
              )}
            </td>
            <td className="py-1.5 text-[var(--text-secondary)] hidden md:table-cell truncate">{c.partner ?? "—"}</td>
            {showChurnDate ? (
              <td className="py-1.5 text-[var(--text-secondary)] text-xs">
                {formatChurnDate(c.churnDate)}
              </td>
            ) : (
              <td className="py-1.5 hidden sm:table-cell">
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  c.status === "active"
                    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                }`}>
                  {c.status}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function formatChurnDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
