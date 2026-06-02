"use client";

import { useState } from "react";
import type { CustomerSummary } from "@/lib/types/report";
import { CustomerDetailRow } from "@/components/customer/CustomerDetailRow";

interface CustomerTableProps {
  customers: CustomerSummary[];
  formatValue: (v: number) => string;
  showChurnDate?: boolean;
  emptyMessage: string;
  /** When true, clicking a row expands the full customer detail. */
  expandable?: boolean;
}

export function CustomerTable({
  customers,
  formatValue,
  showChurnDate,
  emptyMessage,
  expandable,
}: CustomerTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        {customers.map((c) => {
          // Show the company name as the primary label when it differs from the
          // (possibly personal) display name; keep the person as a subtitle.
          const company =
            c.companyName && c.companyName.trim() && c.companyName !== c.name
              ? c.companyName
              : null;
          const primary = company ?? c.name;
          const secondary = company ? c.name : null;
          const isExpanded = expandable && expandedId === c.id;

          return (
            <FragmentRow key={c.id}>
              <tr
                className={`border-t border-[var(--border-subtle)] ${
                  expandable ? "cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors" : ""
                }`}
                onClick={expandable ? () => setExpandedId(isExpanded ? null : c.id) : undefined}
              >
                <td className="py-1.5 text-[var(--text-primary)] font-medium truncate">
                  <div className="truncate">
                    <span className="inline-flex items-center gap-1.5">
                      {expandable && (
                        <span
                          className={`text-[10px] text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          ▸
                        </span>
                      )}
                      <span className="truncate">{primary}</span>
                      {showChurnDate && c.mrr === 0 && (
                        <span
                          className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full align-middle"
                          title="Churned before first invoice — affects logo churn, not revenue churn"
                        >
                          kr 0
                        </span>
                      )}
                    </span>
                    {secondary && (
                      <span className="text-[11px] text-[var(--text-muted)] font-normal block truncate">
                        {secondary}
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
              {isExpanded && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <CustomerDetailRow customerId={c.id} formatValue={formatValue} />
                  </td>
                </tr>
              )}
            </FragmentRow>
          );
        })}
      </tbody>
    </table>
  );
}

// Small helper so each row + its detail share a key without an extra DOM node.
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function formatChurnDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
