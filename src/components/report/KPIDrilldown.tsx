"use client";

import type { ReportData, CustomerSummary } from "@/lib/types/report";
import type { MetricKey } from "@/lib/tooltip-registry";

interface Props {
  metric: MetricKey;
  data: ReportData;
  formatValue: (v: number) => string;
}

const DRILLDOWN_METRICS: MetricKey[] = ["arr", "nrr", "activeCustomers"];

/** Whether a KPI card has an expandable breakdown. */
export function hasDrilldown(metric: MetricKey): boolean {
  return DRILLDOWN_METRICS.includes(metric);
}

export function KPIDrilldown({ metric, data, formatValue }: Props) {
  if (metric === "arr") return <ArrDetail data={data} formatValue={formatValue} />;
  if (metric === "nrr") return <NrrDetail data={data} formatValue={formatValue} />;
  if (metric === "activeCustomers")
    return <SegmentDetail data={data} formatValue={formatValue} />;
  return null;
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${
        strong ? "border-t border-[var(--border-subtle)] font-semibold" : ""
      }`}
    >
      <span className={muted ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"}>
        {label}
      </span>
      <span className="tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

// ── ARR: MRR × 12, with the MRR movement annualised ────────────────────────
function ArrDetail({ data, formatValue }: Omit<Props, "metric">) {
  const d = data.revenue.decomposition;
  const x12 = (v: number) => formatValue(v * 12);
  return (
    <div className="text-xs sm:text-sm">
      <p className="text-[var(--text-muted)] mb-2">
        ARR = MRR ({formatValue(data.revenue.mrr)}) × 12. This month&rsquo;s movement,
        annualised:
      </p>
      <Row label="New" value={`+${x12(d.newMRR)}`} />
      <Row label="Expansion" value={`+${x12(d.expansionMRR)}`} />
      <Row label="Contraction" value={`−${x12(d.contractionMRR)}`} />
      <Row label="Churned" value={`−${x12(d.churnedMRR)}`} />
      <Row label="Net new (annualised)" value={`${d.netNewMRR >= 0 ? "+" : "−"}${x12(Math.abs(d.netNewMRR))}`} strong />
      <Row label="Current ARR" value={formatValue(data.revenue.arr)} strong />
    </div>
  );
}

// ── NRR: expansion vs contraction vs churn on the existing base ────────────
function NrrDetail({ data, formatValue }: Omit<Props, "metric">) {
  const m = data.customers.mrrMovement;
  const sum = (rows: CustomerSummary[], key: "mrrFrom" | "mrrTo" | "mrr") =>
    rows.reduce((t, r) => t + (r[key] ?? r.mrr), 0);
  const expansionTotal = m.expansion.reduce(
    (t, r) => t + ((r.mrrTo ?? r.mrr) - (r.mrrFrom ?? 0)),
    0
  );
  const contractionTotal = m.contraction.reduce(
    (t, r) => t + ((r.mrrFrom ?? 0) - (r.mrrTo ?? r.mrr)),
    0
  );
  const churnTotal = sum(m.churned, "mrr");
  return (
    <div className="text-xs sm:text-sm">
      <p className="text-[var(--text-muted)] mb-2">
        NRR tracks revenue from existing customers — expansion lifts it, contraction
        and churn drag it down (new logos excluded).
      </p>
      <Row label={`Expansion (${m.expansion.length})`} value={`+${formatValue(expansionTotal)}`} />
      <Row label={`Contraction (${m.contraction.length})`} value={`−${formatValue(contractionTotal)}`} />
      <Row label={`Churned (${m.churned.length})`} value={`−${formatValue(churnTotal)}`} />
      <Row
        label="NRR"
        value={data.retention.nrr !== null ? `${data.retention.nrr.toFixed(1)}%` : "—"}
        strong
      />
      {m.churned.length > 0 && (
        <p className="mt-2 text-[var(--text-muted)]">
          Churned: {m.churned.slice(0, 5).map((c) => c.companyName || c.name).join(", ")}
          {m.churned.length > 5 ? ` +${m.churned.length - 5} more` : ""}
        </p>
      )}
    </div>
  );
}

// ── Active Customers: by-segment breakdown ─────────────────────────────────
function SegmentDetail({ data, formatValue }: Omit<Props, "metric">) {
  const segments = [...data.customers.segments].sort((a, b) => b.mrr - a.mrr);
  if (segments.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">No segment data.</p>;
  }
  return (
    <div className="text-xs sm:text-sm">
      <p className="text-[var(--text-muted)] mb-2">Active customers by segment (Regnskabsklasse):</p>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1">
        <span className="text-[var(--text-muted)]">Segment</span>
        <span className="text-right text-[var(--text-muted)]">Customers</span>
        <span className="text-right text-[var(--text-muted)]">MRR</span>
        <span className="text-right text-[var(--text-muted)]">Share</span>
        {segments.map((s) => (
          <Segment key={s.segment} label={s.segment} count={s.customerCount} mrr={formatValue(s.mrr)} pct={s.percentOfTotal} />
        ))}
      </div>
    </div>
  );
}

function Segment({
  label,
  count,
  mrr,
  pct,
}: {
  label: string;
  count: number;
  mrr: string;
  pct: number;
}) {
  return (
    <>
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-right tabular-nums text-[var(--text-primary)]">{count.toLocaleString()}</span>
      <span className="text-right tabular-nums text-[var(--text-primary)]">{mrr}</span>
      <span className="text-right tabular-nums text-[var(--text-muted)]">{pct.toFixed(1)}%</span>
    </>
  );
}
