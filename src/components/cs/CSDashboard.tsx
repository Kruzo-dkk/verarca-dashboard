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

  const warnings = data.dataWarnings ?? [];

  return (
    <div className="space-y-4">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Customer Success
      </h1>
      {warnings.includes("tickets_unavailable") && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          Support-ticketdata er ikke tilgængelig (HubSpot-scope ikke aktiveret),
          så ticket-tal og support-bidraget til health score vises ikke. Øvrige
          tal er upåvirkede.
        </div>
      )}
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
