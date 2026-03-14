"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth/roles";
import { SignOutIcon } from "@/components/nav/NavIcons";

interface UserMenuProps {
  email: string | null;
  displayName: string | null;
  role: UserRole | null;
}

function getInitials(
  displayName: string | null,
  email: string | null,
): string {
  if (displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "?";
}

const roleBadgeStyles: Record<
  UserRole,
  { bg: string; text: string }
> = {
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

export default function UserMenu({ email, displayName, role }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const initials = getInitials(displayName, email);
  const primaryLabel = displayName || email || "User";
  const showEmail = displayName && email && displayName !== email;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-center rounded-full font-medium text-sm transition-colors cursor-pointer"
        style={{
          width: 32,
          height: 32,
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = "brightness(0.92)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
        }}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 rounded-lg overflow-hidden"
          style={{
            minWidth: 200,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
          }}
        >
          {/* Header section */}
          <div
            className="px-4 py-3"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div
              className="font-medium text-sm"
              style={{ color: "var(--text-primary)" }}
            >
              {primaryLabel}
            </div>
            {showEmail && (
              <div
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {email}
              </div>
            )}
            {role && (
              <span
                className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: roleBadgeStyles[role].bg,
                  color: roleBadgeStyles[role].text,
                }}
              >
                {role}
              </span>
            )}
          </div>

          {/* Links section */}
          {role === "management" && (
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/users");
                }}
                className="block w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-surface)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Manage Users
              </button>
            </div>
          )}

          {/* Footer section */}
          <div
            className="py-1"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-surface)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <SignOutIcon className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
