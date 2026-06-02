"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { EnrichedSuggestion } from "@/lib/customer-links";

const METHOD_LABELS: Record<string, string> = {
  email: "samme email",
  name: "samme navn",
  cvr: "samme CVR",
};

/**
 * Lists suggested customer links (email/name matches) for manual review.
 * Confirming a link makes it affect metrics at the next sync; rejecting it
 * prevents it from being re-suggested.
 */
export function SuggestedLinksCard() {
  const [suggestions, setSuggestions] = useState<EnrichedSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer-links");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSuggestions(data.suggestions ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(id: number, status: "confirmed" | "rejected") {
    setPending(id);
    try {
      const res = await fetch(`/api/customer-links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setPending(null);
    }
  }

  if (loading || suggestions.length === 0) return null;

  return (
    <GlassCard>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Foreslåede sammenlægninger ({suggestions.length})
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            Bekræft for at tælle som én kunde
          </span>
        </div>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 text-xs border-t border-[var(--border-subtle)] pt-2"
            >
              <span className="truncate min-w-0">
                <span className="text-[var(--text-primary)] font-medium">{s.canonical.name}</span>
                <span className="text-[var(--text-muted)]"> ↔ </span>
                <span className="text-[var(--text-primary)] font-medium">{s.linked.name}</span>
                <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                  ({METHOD_LABELS[s.matchMethod] ?? s.matchMethod})
                </span>
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => decide(s.id, "confirmed")}
                  disabled={pending === s.id}
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  Bekræft
                </button>
                <button
                  onClick={() => decide(s.id, "rejected")}
                  disabled={pending === s.id}
                  className="px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  Afvis
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
