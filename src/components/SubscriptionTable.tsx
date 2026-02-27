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
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Plan Breakdown
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Plan
              </th>
              <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">
                Active
              </th>
              <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">
                MRR
              </th>
              <th className="pb-3 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.plan}
                className="border-b border-zinc-800/50 last:border-0"
              >
                <td className="py-3 text-sm text-white font-medium">
                  {row.planName}
                </td>
                <td className="py-3 text-sm text-zinc-300 text-right">
                  {row.activeCount}
                </td>
                <td className="py-3 text-sm text-zinc-300 text-right">
                  {formatCurrency(row.mrr, currency)}
                </td>
                <td className="py-3 text-sm text-zinc-400 text-right">
                  {totalMRR > 0
                    ? ((row.mrr / totalMRR) * 100).toFixed(1)
                    : "0.0"}
                  %
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-700">
              <td className="pt-3 text-sm font-bold text-white">Total</td>
              <td className="pt-3 text-sm font-bold text-white text-right">
                {data.reduce((sum, row) => sum + row.activeCount, 0)}
              </td>
              <td className="pt-3 text-sm font-bold text-white text-right">
                {formatCurrency(totalMRR, currency)}
              </td>
              <td className="pt-3 text-sm font-bold text-white text-right">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
