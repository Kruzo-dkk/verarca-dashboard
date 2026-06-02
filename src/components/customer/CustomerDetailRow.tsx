"use client";

import { useState, useEffect } from "react";
import type { LinkedGroup } from "@/lib/types/report";

interface CustomerDetail {
  id: number;
  name: string;
  frisbiiHandle: string;
  email: string | null;
  cvr: string | null;
  segment: string | null;
  plan: string | null;
  partner: string | null;
  status: string;
  startDate: string | null;
  churnDate: string | null;
  matchConfidence: string;
  links: { label: string; url: string }[];
  mrrHistory: { month: string; mrr: number; status: string; plan: string | null }[];
  linkedGroup: LinkedGroup | null;
}

interface CustomerDetailRowProps {
  customerId: number;
  formatValue: (v: number) => string;
}

export function CustomerDetailRow({ customerId, formatValue }: CustomerDetailRowProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/customers/${customerId}`);
        if (!res.ok) throw new Error("Failed to load detail");
        const data = await res.json();
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <div className="flex gap-4">
          <div className="h-4 w-32 rounded bg-[var(--bg-card)] animate-pulse" />
          <div className="h-4 w-24 rounded bg-[var(--bg-card)] animate-pulse" />
          <div className="h-4 w-20 rounded bg-[var(--bg-card)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
        <p className="text-xs text-red-600">{error ?? "No data available"}</p>
      </div>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // MRR sparkline — simple inline SVG
  const sparklineData = detail.mrrHistory.slice(-12); // Last 12 months
  const maxMrr = Math.max(...sparklineData.map((d) => d.mrr), 1);

  return (
    <div className="px-6 py-4 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)] space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Customer details */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Details
          </h4>
          <DetailItem label="Segment" value={detail.segment ?? "—"} />
          <DetailItem label="Plan" value={detail.plan ?? "—"} />
          <DetailItem label="Partner" value={detail.partner ?? "—"} />
          <DetailItem label="Email" value={detail.email ?? "—"} />
          <DetailItem label="CVR" value={detail.cvr ?? "—"} />
        </div>

        {/* Dates & Status */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Timeline
          </h4>
          <DetailItem label="Started" value={formatDate(detail.startDate)} />
          {detail.churnDate && (
            <DetailItem label="Churned" value={formatDate(detail.churnDate)} />
          )}
          <DetailItem label="Match" value={detail.matchConfidence} />
          <DetailItem label="Frisbii Handle" value={detail.frisbiiHandle} />
        </div>

        {/* MRR Sparkline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            MRR History (12M)
          </h4>
          {sparklineData.length > 1 ? (
            <div className="flex items-end gap-px h-16">
              {sparklineData.map((d, i) => {
                const height = maxMrr > 0 ? (d.mrr / maxMrr) * 100 : 0;
                const isLast = i === sparklineData.length - 1;
                return (
                  <div
                    key={d.month}
                    className="flex-1 rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: isLast
                        ? "var(--accent-teal)"
                        : d.status === "active"
                        ? "var(--accent-teal)"
                        : "#ef4444",
                      opacity: isLast ? 1 : 0.5,
                    }}
                    title={`${d.month}: ${formatValue(d.mrr)}`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Insufficient data</p>
          )}
          {sparklineData.length > 1 && (
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{sparklineData[0].month}</span>
              <span>{sparklineData[sparklineData.length - 1].month}</span>
            </div>
          )}
        </div>
      </div>

      {/* Linked accounts — each member's individual contribution */}
      {detail.linkedGroup && (
        <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Sammenlagte konti ({detail.linkedGroup.members.length})
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 font-medium">
              Tæller som 1 kunde · {detail.linkedGroup.activeSubscriptionCount} aktive abonnementer · samlet MRR {formatValue(detail.linkedGroup.totalMrr)}
            </span>
          </div>
          <div className="space-y-1">
            {detail.linkedGroup.members.map((m) => (
              <div
                key={m.frisbiiHandle}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-1.5 truncate min-w-0">
                  <span className="truncate text-[var(--text-secondary)]">{m.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{m.frisbiiHandle}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      m.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                    }`}
                  >
                    {m.status}
                  </span>
                </span>
                <span className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[var(--text-muted)] hidden sm:inline">{m.plan ?? "—"}</span>
                  <span className="tabular-nums text-[var(--text-primary)] font-medium">{formatValue(m.mrr)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External links */}
      {detail.links.length > 0 && (
        <div className="flex gap-2 pt-2 border-t border-[var(--border-subtle)]">
          {detail.links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--accent-teal)] bg-[var(--accent-teal)]/10 rounded-lg hover:bg-[var(--accent-teal)]/20 transition-colors"
            >
              {link.label}
              <ExternalLinkIcon />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 1.5H2a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V7.5M7 1.5h3.5V5M5.5 6.5L10.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
