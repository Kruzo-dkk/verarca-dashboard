import { GlassCard } from "@/components/ui/GlassCard";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <h1 className="section-heading text-2xl text-[var(--text-primary)]">
        Customers
      </h1>
      <GlassCard>
        <p className="text-sm text-[var(--text-muted)]">
          Customer list with expandable detail rows — coming in Phase 5.
        </p>
      </GlassCard>
    </div>
  );
}
