"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the dashboard. Catches any error not handled
 * by a per-section ErrorBoundary so the app shows a recoverable fallback
 * instead of a blank screen.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Noget gik galt
      </h2>
      <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">
        Dashboardet kunne ikke indlæses. Prøv igen — sker det igen, så genindlæs siden.
      </p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-coral,#e07a5f)] text-white hover:opacity-90 transition-opacity"
      >
        Prøv igen
      </button>
    </div>
  );
}
