"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useReportContext } from "@/components/providers/ReportProvider";
import type { CSDashboardData } from "@/lib/types/cs";

interface CSContextType {
  data: CSDashboardData | null;
  loading: boolean;
  error: string | null;
}

const CSContext = createContext<CSContextType | null>(null);

export function CSProvider({ children }: { children: ReactNode }) {
  const { month } = useReportContext();

  const [data, setData] = useState<CSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cs?month=${month}`);
      if (!res.ok) throw new Error("Failed to load CS data");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <CSContext.Provider value={{ data, loading, error }}>
      {children}
    </CSContext.Provider>
  );
}

export function useCSContext() {
  const ctx = useContext(CSContext);
  if (!ctx)
    throw new Error("useCSContext must be used within CSProvider");
  return ctx;
}
