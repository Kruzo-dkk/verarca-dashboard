"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/auth/roles";

interface UseUserRoleResult {
  role: UserRole | null;
  email: string | null;
  displayName: string | null;
  loading: boolean;
}

/**
 * Client-side hook to fetch the current user's role.
 * Caches the result for the session to avoid repeated DB queries.
 */
let cachedRole: UserRole | null = null;
let cachedEmail: string | null = null;
let cachedDisplayName: string | null = null;

export function useUserRole(): UseUserRoleResult {
  const [role, setRole] = useState<UserRole | null>(cachedRole);
  const [email, setEmail] = useState<string | null>(cachedEmail);
  const [displayName, setDisplayName] = useState<string | null>(cachedDisplayName);
  const [loading, setLoading] = useState(cachedRole === null);

  useEffect(() => {
    if (cachedRole !== null) return;

    let cancelled = false;
    async function fetchRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      cachedEmail = user.email ?? null;
      if (!cancelled) setEmail(cachedEmail);

      const { data } = await supabase
        .from("user_profiles")
        .select("role, display_name")
        .eq("id", user.id)
        .single();

      if (!cancelled && data) {
        const r = data.role as UserRole;
        cachedRole = r;
        setRole(r);

        cachedDisplayName = data.display_name ?? null;
        setDisplayName(cachedDisplayName);
      }
      if (!cancelled) setLoading(false);
    }

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, []);

  return { role, email, displayName, loading };
}
