import { GlassCard } from "@/components/ui/GlassCard";

export default function ForecastPage() {
  return (
    <div className="space-y-6">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Forecast
      </h1>
      <GlassCard>
        <p className="text-sm text-[var(--text-muted)]">
          Scenario-based MRR/ARR forecasting — coming in Phase 7.
        </p>
      </GlassCard>
    </div>
  );
}
