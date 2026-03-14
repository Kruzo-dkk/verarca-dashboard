"use client";

import { useState, useMemo, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useReportContext } from "@/components/providers/ReportProvider";
import { CustomerDetailRow } from "./CustomerDetailRow";
import type { CustomerSummary } from "@/lib/types/report";

interface SegmentBreakdown {
  segment: string;
  customerCount: number;
  mrr: number;
  percentOfTotal: number;
}

interface CustomerListData {
  month: string;
  count: number;
  newLogos: number;
  churnedLogos: number;
  arpa: number;
  top10Concentration: number | null;
  segments: SegmentBreakdown[];
  customers: CustomerSummary[];
}

type SortField = "name" | "mrr" | "plan" | "status" | "partner" | "segment";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "active" | "churned";

export function CustomerList() {
  const { month, formatValue } = useReportContext();

  const [data, setData] = useState<CustomerListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("mrr");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch data when month changes
  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers?month=${m}`);
      if (!res.ok) throw new Error("Failed to load customer data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch on mount and month change
  useState(() => {
    fetchData(month);
  });

  // Re-fetch when month changes
  const [prevMonth, setPrevMonth] = useState(month);
  if (month !== prevMonth) {
    setPrevMonth(month);
    fetchData(month);
    setExpandedId(null);
  }

  // Filter + sort
  const filteredCustomers = useMemo(() => {
    if (!data) return [];
    let list = data.customers;

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.plan ?? "").toLowerCase().includes(q) ||
          (c.partner ?? "").toLowerCase().includes(q) ||
          (c.segment ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    const dir = sortDirection === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "mrr":
          return dir * (a.mrr - b.mrr);
        case "plan":
          return dir * (a.plan ?? "").localeCompare(b.plan ?? "");
        case "status":
          return dir * a.status.localeCompare(b.status);
        case "partner":
          return dir * (a.partner ?? "").localeCompare(b.partner ?? "");
        case "segment":
          return dir * (a.segment ?? "").localeCompare(b.segment ?? "");
        default:
          return 0;
      }
    });

    return list;
  }, [data, search, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-[var(--text-muted)] opacity-30 ml-1">↕</span>;
    return <span className="text-[var(--accent-coral)] ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-12 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-96 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <p className="text-sm text-red-600">Error: {error}</p>
      </GlassCard>
    );
  }

  if (!data) return null;

  const formatMonth = (ym: string) => {
    const [y, m] = ym.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="section-heading text-2xl text-[var(--text-primary)]">Customers</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {data.count} customers as of <strong>{formatMonth(data.month)}</strong>
          {" · "}
          <span className="text-emerald-600">+{data.newLogos} new</span>
          {" · "}
          <span className="text-red-600">-{data.churnedLogos} churned</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <GlassCard className="text-center py-3">
          <span className="text-xs text-[var(--text-muted)]">Total</span>
          <div className="metric-value text-xl mt-1">{data.count}</div>
        </GlassCard>
        <GlassCard className="text-center py-3">
          <span className="text-xs text-[var(--text-muted)]">ARPA</span>
          <div className="metric-value text-xl mt-1">{formatValue(data.arpa)}</div>
        </GlassCard>
        <GlassCard className="text-center py-3">
          <span className="text-xs text-[var(--text-muted)]">Top 10 Concentration</span>
          <div className={`metric-value text-xl mt-1 ${
            data.top10Concentration !== null && data.top10Concentration > 30
              ? "text-amber-600"
              : "text-emerald-600"
          }`}>
            {data.top10Concentration !== null ? `${data.top10Concentration.toFixed(1)}%` : "—"}
          </div>
        </GlassCard>
        <GlassCard className="text-center py-3">
          <span className="text-xs text-[var(--text-muted)]">Showing</span>
          <div className="metric-value text-xl mt-1">{filteredCustomers.length}</div>
        </GlassCard>
      </div>

      {/* Segment breakdown */}
      {data.segments && data.segments.length > 0 && (
        <GlassCard>
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Segment Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.segments.map((seg) => (
              <div
                key={seg.segment}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-secondary)]"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {seg.segment}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {seg.customerCount} customer{seg.customerCount !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm metric-value">{formatValue(seg.mrr)}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {seg.percentOfTotal.toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Filters */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers, plans, partners..."
              className="w-full px-3 py-2.5 sm:py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-teal)] focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit">
            {(["all", "active", "churned"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 sm:px-3 sm:py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  statusFilter === status
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)]">
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort("name")} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
                    Customer <SortIcon field="name" />
                  </button>
                </th>
                <th className="pb-2 font-medium text-right">
                  <button onClick={() => handleSort("mrr")} className="flex items-center justify-end hover:text-[var(--text-primary)] transition-colors ml-auto">
                    MRR <SortIcon field="mrr" />
                  </button>
                </th>
                <th className="pb-2 font-medium hidden sm:table-cell">
                  <button onClick={() => handleSort("plan")} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
                    Plan <SortIcon field="plan" />
                  </button>
                </th>
                <th className="pb-2 font-medium hidden md:table-cell">
                  <button onClick={() => handleSort("partner")} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
                    Partner <SortIcon field="partner" />
                  </button>
                </th>
                <th className="pb-2 font-medium hidden lg:table-cell">
                  <button onClick={() => handleSort("segment")} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
                    Segment <SortIcon field="segment" />
                  </button>
                </th>
                <th className="pb-2 font-medium">
                  <button onClick={() => handleSort("status")} className="flex items-center hover:text-[var(--text-primary)] transition-colors">
                    Status <SortIcon field="status" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  formatValue={formatValue}
                  expanded={expandedId === customer.id}
                  onToggle={() =>
                    setExpandedId(expandedId === customer.id ? null : customer.id)
                  }
                />
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                    No customers match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Individual customer row ────────────────────────────────────────

function CustomerRow({
  customer,
  formatValue,
  expanded,
  onToggle,
}: {
  customer: CustomerSummary;
  formatValue: (v: number) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-t border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <td className="py-2.5 text-[var(--text-primary)] font-medium">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
            >
              ▸
            </span>
            <div>
              {customer.name}
              {/* Show plan as subtitle on mobile where the plan column is hidden */}
              {customer.plan && (
                <div className="text-[11px] text-[var(--text-muted)] font-normal sm:hidden">
                  {customer.plan}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="py-2.5 text-right metric-value">{formatValue(customer.mrr)}</td>
        <td className="py-2.5 text-[var(--text-secondary)] hidden sm:table-cell">
          {customer.plan ?? "—"}
        </td>
        <td className="py-2.5 text-[var(--text-secondary)] hidden md:table-cell">
          {customer.partner ?? "—"}
        </td>
        <td className="py-2.5 text-[var(--text-secondary)] hidden lg:table-cell">
          {customer.segment ?? "—"}
        </td>
        <td className="py-2.5">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              customer.status === "active"
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
            }`}
          >
            {customer.status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <CustomerDetailRow customerId={customer.id} formatValue={formatValue} />
          </td>
        </tr>
      )}
    </>
  );
}
