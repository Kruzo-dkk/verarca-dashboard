"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useReportContext } from "@/components/providers/ReportProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { CSDashboardData } from "@/lib/types/cs";

interface CSContextType {
  data: CSDashboardData | null;
  loading: boolean;
  error: string | null;
}

const CSContext = createContext<CSContextType | null>(null);

export function CSProvider({ children }: { children: ReactNode }) {
  const { month } = useReportContext();
  const { data, loading, error } = useDashboardData<CSDashboardData>(
    `/api/cs?month=${month}`,
    { intervalMs: 60_000 }
  );

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
