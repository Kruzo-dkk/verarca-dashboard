"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useReportContext } from "@/components/providers/ReportProvider";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { SalesDashboardData } from "@/lib/types/sales";

interface SalesContextType {
  data: SalesDashboardData | null;
  loading: boolean;
  error: string | null;
  tvMode: boolean;
  rotateMode: boolean;
  rotateInterval: number;
  currentScreen: number;
  setCurrentScreen: (n: number) => void;
}

const SalesContext = createContext<SalesContextType | null>(null);

export function SalesProvider({ children }: { children: ReactNode }) {
  const { month } = useReportContext();
  const searchParams = useSearchParams();

  const tvMode = searchParams.get("tv") === "true";
  const rotateMode = searchParams.get("rotate") === "true";
  const rotateInterval = parseInt(searchParams.get("interval") ?? "20", 10);

  const { data, loading, error } = useDashboardData<SalesDashboardData>(
    `/api/sales?month=${month}`,
    { intervalMs: 60_000 }
  );

  const [currentScreen, setCurrentScreen] = useState(0);

  // Auto-rotate screens in TV mode
  useEffect(() => {
    if (!tvMode || !rotateMode) return;
    const interval = setInterval(() => {
      setCurrentScreen((prev) => (prev + 1) % 4);
    }, rotateInterval * 1000);
    return () => clearInterval(interval);
  }, [tvMode, rotateMode, rotateInterval]);

  return (
    <SalesContext.Provider
      value={{
        data,
        loading,
        error,
        tvMode,
        rotateMode,
        rotateInterval,
        currentScreen,
        setCurrentScreen,
      }}
    >
      {children}
    </SalesContext.Provider>
  );
}

export function useSalesContext() {
  const ctx = useContext(SalesContext);
  if (!ctx)
    throw new Error("useSalesContext must be used within SalesProvider");
  return ctx;
}
