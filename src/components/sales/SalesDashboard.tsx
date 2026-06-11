"use client";

import { useSalesContext } from "./SalesProvider";
import { TargetProgress } from "./TargetProgress";
import { PipelineBoard } from "./PipelineBoard";
import { ActivityFeed } from "./ActivityFeed";
import { Leaderboard } from "./Leaderboard";
import { EmployeeComparison } from "./EmployeeComparison";
import { RecentOutcomes } from "./RecentOutcomes";
import { TVModeWrapper } from "./TVModeWrapper";
import { GlassCard } from "@/components/ui/GlassCard";

export function SalesDashboard() {
  const { data, loading, error, tvMode } = useSalesContext();

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <GlassCard>
        <p className="text-red-500 text-sm">Error: {error}</p>
      </GlassCard>
    );
  if (!data) return null;

  if (tvMode) return <TVModeWrapper />;

  return (
    <div className="space-y-4">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Sales Dashboard
      </h1>
      <TargetProgress />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed />
        <Leaderboard />
      </div>
      <EmployeeComparison />
      <PipelineBoard />
      <RecentOutcomes />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-[var(--bg-secondary)] animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
      <div className="h-64 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
        <div className="h-48 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    </div>
  );
}
