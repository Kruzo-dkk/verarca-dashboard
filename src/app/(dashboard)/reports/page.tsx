"use client";

import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { BoardReport } from "@/components/board/BoardReport";
import { InvestorDashboard } from "@/components/investor/InvestorDashboard";

type ReportTab = "board" | "investor";

export default function ReportsPage() {
  const { role } = useUserRole();

  // Board/investor roles see only their view — no tabs
  if (role === "board") return <BoardReport />;
  if (role === "investor") return <InvestorDashboard />;

  // Management sees tab toggle
  return <ReportsWithTabs />;
}

function ReportsWithTabs() {
  const [tab, setTab] = useState<ReportTab>("board");

  return (
    <div>
      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-[var(--bg-surface)] p-1 w-fit">
        <TabButton active={tab === "board"} onClick={() => setTab("board")}>
          Board Report
        </TabButton>
        <TabButton active={tab === "investor"} onClick={() => setTab("investor")}>
          Investor View
        </TabButton>
      </div>

      {tab === "board" ? <BoardReport /> : <InvestorDashboard />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}
