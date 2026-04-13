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
import type { DataQualityData } from "@/lib/types/data-quality";

interface DataQualityContextType {
  data: DataQualityData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const DataQualityContext = createContext<DataQualityContextType | null>(null);

export function DataQualityProvider({ children }: { children: ReactNode }) {
  const { month } = useReportContext();

  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/data-quality?month=${month}`);
      if (!res.ok) throw new Error("Failed to load data quality data");
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
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <DataQualityContext.Provider value={{ data, loading, error, refresh: fetchData }}>
      {children}
    </DataQualityContext.Provider>
  );
}

export function useDataQuality() {
  const ctx = useContext(DataQualityContext);
  if (!ctx)
    throw new Error("useDataQuality must be used within DataQualityProvider");
  return ctx;
}
