"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  CustomersIcon,
  ForecastIcon,
  SettingsIcon,
} from "./NavIcons";

const navItems = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
  { href: "/forecast", label: "Forecast", icon: ForecastIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Fixed bottom navigation bar for mobile (<lg breakpoint). */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/95 backdrop-blur-sm lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                active
                  ? "text-[var(--accent-coral)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
