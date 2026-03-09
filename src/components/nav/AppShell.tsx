"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReportContext } from "@/components/providers/ReportProvider";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { CurrencyToggle } from "@/components/ui/CurrencyToggle";
import { BottomNav } from "./BottomNav";
import {
  DashboardIcon,
  CustomersIcon,
  ForecastIcon,
  SettingsIcon,
  RefreshIcon,
} from "./NavIcons";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
  { href: "/forecast", label: "Forecast", icon: ForecastIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * AppShell wraps all dashboard pages with:
 * - Desktop: horizontal header (title + tabs + controls)
 * - Mobile: top header (title + controls) + fixed bottom nav
 *
 * Content area has bottom padding on mobile to clear the BottomNav.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { period, setPeriod, currency, setCurrency, loading, refresh } =
    useReportContext();

  return (
    <div className="min-h-screen">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Left: Brand */}
            <Link href="/" className="shrink-0">
              <h1 className="section-heading text-lg text-[var(--text-primary)]">
                Verarca
              </h1>
            </Link>

            {/* Centre: Desktop nav tabs (hidden on mobile) */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--accent-coral)]/10 text-[var(--accent-coral)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              <PeriodSelector value={period} onChange={setPeriod} />
              <div className="hidden sm:block">
                <CurrencyToggle value={currency} onChange={setCurrency} />
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                aria-label="Refresh data"
              >
                <RefreshIcon
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 pb-20 lg:pb-6">
        {children}
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────────── */}
      <BottomNav />
    </div>
  );
}
