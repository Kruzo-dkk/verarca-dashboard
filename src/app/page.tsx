"use client";

import { useEffect, useState, useCallback } from "react";
import { KPICard } from "@/components/KPICard";
import { RevenueChart } from "@/components/RevenueChart";
import { ChurnChart } from "@/components/ChurnChart";
import { SubscriptionTable } from "@/components/SubscriptionTable";

interface Metrics {
  mrr: number;
  arr: number;
  activeCustomerCount: number;
  churnRate: number;
  netNewMRR: number;
  arpc: number;
  currency: string;
  updatedAt: string;
}

interface RevenueData {
  monthlyRevenue: { month: string; revenue: number }[];
}

interface ChurnDataPoint {
  month: string;
  churnRate: number;
  expiredCount: number;
  activeAtStart: number;
}

interface ChurnData {
  monthlyChurn: ChurnDataPoint[];
}

interface SubscriptionData {
  breakdown: {
    plan: string;
    planName: string;
    activeCount: number;
    mrr: number;
  }[];
  totalActive: number;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-zinc-900 border border-zinc-800 ${className}`}
    />
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, revenueRes, churnRes, subsRes] = await Promise.all([
        fetch("/api/metrics"),
        fetch("/api/revenue?months=12"),
        fetch("/api/churn?months=12"),
        fetch("/api/subscriptions"),
      ]);

      if (!metricsRes.ok || !revenueRes.ok || !churnRes.ok || !subsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const [metricsData, revenueData, churnData, subsData] = await Promise.all([
        metricsRes.json(),
        revenueRes.json(),
        churnRes.json(),
        subsRes.json(),
      ]);

      setMetrics(metricsData);
      setRevenue(revenueData);
      setChurn(churnData);
      setSubscriptions(subsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // refresh every 5 minutes
    return () => clearInterval(interval);
  }, [fetchData]);

  const currency = metrics?.currency ?? "USD";

  const churnData = churn?.monthlyChurn ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 font-sans">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Verarca
            </h1>
            <p className="text-sm text-zinc-500">SaaS Metrics Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            {metrics?.updatedAt && (
              <span className="text-xs text-zinc-600">
                Updated {new Date(metrics.updatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {loading && !metrics ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : metrics ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Monthly Recurring Revenue"
              value={formatCurrency(metrics.mrr, currency)}
            />
            <KPICard
              label="Annual Recurring Revenue"
              value={formatCurrency(metrics.arr, currency)}
            />
            <KPICard
              label="Active Customers"
              value={metrics.activeCustomerCount.toLocaleString()}
            />
            <KPICard
              label="Churn Rate"
              value={`${metrics.churnRate.toFixed(1)}%`}
            />
          </div>
        ) : null}

        {/* Secondary KPIs */}
        {metrics && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              label="Net New MRR"
              value={formatCurrency(metrics.netNewMRR, currency)}
              trend={metrics.mrr > 0 ? (metrics.netNewMRR / metrics.mrr) * 100 : 0}
            />
            <KPICard
              label="Avg Revenue Per Customer"
              value={formatCurrency(metrics.arpc, currency)}
            />
            <KPICard
              label="Total Active Subscriptions"
              value={subscriptions?.totalActive.toLocaleString() ?? "—"}
            />
          </div>
        )}

        {/* Revenue Chart */}
        {loading && !revenue ? (
          <div className="mb-8">
            <Skeleton className="h-96" />
          </div>
        ) : revenue ? (
          <div className="mb-8">
            <RevenueChart
              data={revenue.monthlyRevenue}
              currency={currency}
            />
          </div>
        ) : null}

        {/* Bottom Row: Churn + Plan Breakdown */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {loading && !churn ? (
            <Skeleton className="h-80" />
          ) : churn ? (
            <ChurnChart data={churnData} />
          ) : null}
          {loading && !subscriptions ? (
            <Skeleton className="h-80" />
          ) : subscriptions ? (
            <SubscriptionTable
              data={subscriptions.breakdown}
              currency={currency}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
