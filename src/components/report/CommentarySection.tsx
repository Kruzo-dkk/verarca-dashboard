"use client";

import { useState, useCallback } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

interface CommentarySectionProps {
  month: string;
  executiveSummary: string | null;
  highlights: string | null;
  lowlights: string | null;
  whatsAhead: string | null;
}

export function CommentarySection({
  month,
  executiveSummary,
  highlights,
  lowlights,
  whatsAhead,
}: CommentarySectionProps) {
  return (
    <section>
      <h2 className="section-heading text-xl mb-4 text-[var(--text-primary)]">Commentary</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CommentaryField
          month={month}
          field="executiveSummary"
          label="Executive Summary"
          value={executiveSummary}
          rows={4}
        />
        <CommentaryField
          month={month}
          field="highlights"
          label="Highlights"
          value={highlights}
          rows={3}
        />
        <CommentaryField
          month={month}
          field="lowlights"
          label="Lowlights"
          value={lowlights}
          rows={3}
        />
        <CommentaryField
          month={month}
          field="whatsAhead"
          label="What's Ahead"
          value={whatsAhead}
          rows={3}
        />
      </div>
    </section>
  );
}

function CommentaryField({
  month,
  field,
  label,
  value,
  rows,
}: {
  month: string;
  field: string;
  label: string;
  value: string | null;
  rows: number;
}) {
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/commentary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, [field]: text }),
      });
    } catch (err) {
      console.error("Failed to save commentary:", err);
    } finally {
      setSaving(false);
    }
  }, [month, field, text]);

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-[var(--text-muted)]">{label}</h3>
        {saving && <span className="text-[10px] text-[var(--accent-blue)]">Saving...</span>}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={rows}
        placeholder={`Add ${label.toLowerCase()}...`}
        className="w-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-blue)] resize-none"
      />
    </GlassCard>
  );
}
