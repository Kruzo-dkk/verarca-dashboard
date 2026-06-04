"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Options {
  /** Poll interval in ms. Omit or 0 to disable polling. */
  intervalMs?: number;
  /** When false, no fetch runs (data stays null, loading false). */
  enabled?: boolean;
}

interface Result<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Shared dashboard fetch: loading/error/data state, optional polling, and
 * AbortController so a superseded request (rapid month-switching) can't land
 * after a newer one. Replaces the per-provider fetch boilerplate.
 *
 * Background poll ticks are `silent` — they refresh data without toggling the
 * loading flag, so the UI doesn't flicker every interval (matches the old
 * per-provider behaviour). The initial load and explicit refresh() do show it.
 */
export function useDashboardData<T>(url: string, options: Options = {}): Result<T> {
  const { intervalMs, enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (silent = false) => {
      // Cancel any in-flight request before starting a newer one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!silent) setLoading(true);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = (await res.json()) as T;
        setData(json);
        setError(null);
      } catch (err) {
        // A superseded request was aborted on purpose — ignore it.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        // Only the latest request owns the loading flag.
        if (!silent && abortRef.current === controller) setLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    if (!enabled) return;
    fetchData();
    if (!intervalMs) return () => abortRef.current?.abort();
    const id = setInterval(() => fetchData(true), intervalMs);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchData, enabled, intervalMs]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  return { data, loading, error, refresh };
}
