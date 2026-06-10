"use client";

import { useEffect, useState } from "react";
import { CommentarySection } from "@/components/report/CommentarySection";
import { addMonths } from "@/lib/budget";

interface Commentary {
  executiveSummary: string | null;
  highlights: string | null;
  lowlights: string | null;
  whatsAhead: string | null;
}

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The "word-heavy" monthly inputs — free-text Notes (settings.notes) plus the
 * Executive Summary / Highlights / Lowlights / What's Ahead commentary
 * (monthly_snapshots, edited via the shared CommentarySection). Pick a month and
 * everything autosaves.
 */
export function MonthlyNarrative() {
  const cur = thisMonth();
  const months = Array.from({ length: 18 }, (_, i) => addMonths(cur, -i)); // current → 17 back
  const [month, setMonth] = useState(cur);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    Promise.all([
      fetch(`/api/commentary?month=${month}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/settings?month=${month}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([cm, st]) => {
      if (!active) return;
      setCommentary({
        executiveSummary: cm?.executiveSummary ?? null,
        highlights: cm?.highlights ?? null,
        lowlights: cm?.lowlights ?? null,
        whatsAhead: cm?.whatsAhead ?? null,
      });
      setNotes(st?.notes ?? "");
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [month]);

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, field: "notes", value: notes }),
      });
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Notes &amp; Commentary</h2>
        <label className="text-sm text-[var(--text-muted)] flex items-center gap-2">
          Month
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-[var(--text-primary)] bg-white"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
          Notes {savingNotes && <span className="text-gray-400">· Saving…</span>}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={3}
          placeholder="Free-text notes for this month…"
          className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--text-primary)]/30"
        />
      </div>

      {loaded && commentary && (
        <CommentarySection
          key={month}
          month={month}
          executiveSummary={commentary.executiveSummary}
          highlights={commentary.highlights}
          lowlights={commentary.lowlights}
          whatsAhead={commentary.whatsAhead}
        />
      )}
    </section>
  );
}
