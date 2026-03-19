"use client";

import { useCSContext } from "./CSProvider";
import { TierBreakdown } from "./TierBreakdown";
import { HealthDistribution } from "./HealthDistribution";
import { SupportMetrics } from "./SupportMetrics";
import { AtRiskCustomers } from "./AtRiskCustomers";
import { ManagedPerformance } from "./ManagedPerformance";
import { GlassCard } from "@/components/ui/GlassCard";

export function CSDashboard() {
  const { data, loading, error } = useCSContext();

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <GlassCard>
        <p className="text-red-500 text-sm">Error: {error}</p>
      </GlassCard>
    );
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Customer Success
      </h1>
      <TierBreakdown />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HealthDistribution />
        <SupportMetrics />
      </div>
      <AtRiskCustomers />
      <ManagedPerformance />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
      <div className="h-32 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
      <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      <div className="h-48 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
    </div>
  );
}
