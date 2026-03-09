"use client";

interface PlanRow {
  plan: string;
  planName: string;
  activeCount: number;
  mrr: number;
}

interface SubscriptionTableProps {
  data: PlanRow[];
  currency?: string;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function SubscriptionTable({
  data,
  currency = "USD",
}: SubscriptionTableProps) {
  const totalMRR = data.reduce((sum, row) => sum + row.mrr, 0);

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-medium text-[var(--text-muted)] mb-4">
        Plan Breakdown
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="pb-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Plan
              </th>
              <th className="pb-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right">
                Active
              </th>
              <th className="pb-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right">
                MRR
              </th>
              <th className="pb-3 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider text-right">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.plan}
                className="border-b border-[var(--border-subtle)] last:border-0"
              >
                <td className="py-3 text-sm text-[var(--text-primary)] font-medium">
                  {row.planName}
                </td>
                <td className="py-3 text-sm text-[var(--text-secondary)] text-right">
                  {row.activeCount}
                </td>
                <td className="py-3 text-sm text-[var(--text-secondary)] text-right">
                  {formatCurrency(row.mrr, currency)}
                </td>
                <td className="py-3 text-sm text-[var(--text-muted)] text-right">
                  {totalMRR > 0
                    ? ((row.mrr / totalMRR) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--border-medium)]">
              <td className="pt-3 text-sm font-bold text-[var(--text-primary)]">Total</td>
              <td className="pt-3 text-sm font-bold text-[var(--text-primary)] text-right">
                {data.reduce((sum, row) => sum + row.activeCount, 0)}
              </td>
              <td className="pt-3 text-sm font-bold text-[var(--text-primary)] text-right">
                {formatCurrency(totalMRR, currency)}
              </td>
              <td className="pt-3 text-sm font-bold text-[var(--text-primary)] text-right">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
