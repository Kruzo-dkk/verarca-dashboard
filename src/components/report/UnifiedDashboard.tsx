"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { ReportShell } from "@/components/report/ReportShell";
import { BoardReport } from "@/components/board/BoardReport";
import { InvestorDashboard } from "@/components/investor/InvestorDashboard";
import { SalesProvider } from "@/components/sales/SalesProvider";
import { SalesDashboard } from "@/components/sales/SalesDashboard";
import { CSProvider } from "@/components/cs/CSProvider";
import { CSDashboard } from "@/components/cs/CSDashboard";

type ViewTab = "dashboard" | "sales" | "cs" | "board" | "investor";

const TABS: { key: ViewTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "sales", label: "Sales" },
  { key: "cs", label: "Customer Success" },
  { key: "board", label: "Board Report" },
  { key: "investor", label: "Investor View" },
];

export function UnifiedDashboard() {
  const { role } = useUserRole();

  // Board/investor roles see only their view — no tabs
  if (role === "board") return <BoardReport />;
  if (role === "investor") return <InvestorDashboard />;

  // Management sees 3-tab toggle
  return <DashboardWithTabs />;
}

function DashboardWithTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const viewParam = searchParams.get("view") as ViewTab | null;
  const [tab, setTab] = useState<ViewTab>(
    viewParam && TABS.some((t) => t.key === viewParam) ? viewParam : "dashboard"
  );

  const handleTabChange = (newTab: ViewTab) => {
    setTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "dashboard") {
      params.delete("view");
    } else {
      params.set("view", newTab);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  return (
    <div>
      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--bg-surface)] p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <ReportShell />}
      {tab === "sales" && (
        <SalesProvider>
          <SalesDashboard />
        </SalesProvider>
      )}
      {tab === "cs" && (
        <CSProvider>
          <CSDashboard />
        </CSProvider>
      )}
      {tab === "board" && <BoardReport />}
      {tab === "investor" && <InvestorDashboard />}
    </div>
  );
}
