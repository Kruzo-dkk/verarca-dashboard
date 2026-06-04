"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useReportContext } from "@/components/providers/ReportProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
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
  const { data, loading, error, refresh } = useDashboardData<DataQualityData>(
    `/api/data-quality?month=${month}`,
    { intervalMs: 60_000 }
  );

  return (
    <DataQualityContext.Provider value={{ data, loading, error, refresh }}>
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
