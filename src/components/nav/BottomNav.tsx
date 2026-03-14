"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NavItem } from "./AppShell";
import type { UserRole } from "@/lib/auth/roles";
import BottomSheet from "./BottomSheet";
import { MoreIcon, SignOutIcon } from "./NavIcons";

interface BottomNavProps {
  items: NavItem[];
  overflowItems?: NavItem[];
  email?: string | null;
  displayName?: string | null;
  role?: UserRole | null;
}

const roleBadgeStyles: Record<UserRole, { bg: string; text: string }> = {
  management: {
    bg: "rgba(var(--accent-coral-rgb, 255,107,107), 0.1)",
    text: "var(--accent-coral)",
  },
  board: {
    bg: "rgba(26, 92, 90, 0.1)",
    text: "#1A5C5A",
  },
  investor: {
    bg: "rgba(16, 185, 129, 0.1)",
    text: "#10B981",
  },
};

/** Fixed bottom navigation bar for mobile (<lg breakpoint). */
export function BottomNav({
  items,
  overflowItems,
  email,
  displayName,
  role,
}: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasOverflow = overflowItems && overflowItems.length > 0;

  // The More button should appear active when the sheet is open
  // or when the current path matches an overflow item
  const overflowActive =
    hasOverflow &&
    overflowItems.some((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
    );
  const moreActive = sheetOpen || overflowActive;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const primaryLabel = displayName || email || "User";

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--bg-card)]/95 backdrop-blur-sm lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
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

          {hasOverflow && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                moreActive
                  ? "text-[var(--accent-coral)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <MoreIcon className="w-6 h-6" />
              <span className="text-[11px] font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* More bottom sheet */}
      {hasOverflow && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          {/* Overflow nav links */}
          <div className="flex flex-col">
            {overflowItems.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSheetOpen(false)}
                  className={`flex items-center gap-3 w-full px-3 py-3 rounded-lg transition-colors ${
                    active
                      ? "text-[var(--accent-coral)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-[var(--border-subtle)]" />

          {/* User section */}
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {primaryLabel}
              </span>
              {role && (
                <span
                  className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: roleBadgeStyles[role].bg,
                    color: roleBadgeStyles[role].text,
                  }}
                >
                  {role}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full mt-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
            >
              <SignOutIcon className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
