import { GlassCard } from "@/components/ui/GlassCard";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Settings
      </h1>
      <GlassCard>
        <p className="text-sm text-[var(--text-muted)]">
          CAC inputs, employee count overrides, and notes — coming in Phase 4.
        </p>
      </GlassCard>
    </div>
  );
}
