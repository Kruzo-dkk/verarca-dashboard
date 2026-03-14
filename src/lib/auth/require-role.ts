import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "./roles";

interface AuthResult {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Server-side guard for API routes.
 *
 * Verifies the user is authenticated AND has one of the allowed roles.
 * Uses the admin client (service_role) to read user_profiles, bypassing RLS.
 *
 * Usage in route handlers:
 * ```ts
 * const auth = await requireRole(["management"]);
 * if (auth instanceof NextResponse) return auth; // 401/403
 * const { userId, role } = auth;
 * ```
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthResult | NextResponse> {
  // 1. Check authentication
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2. Fetch role from user_profiles (via admin to bypass RLS)
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "No user profile found. Contact an administrator." },
      { status: 403 }
    );
  }

  // 3. Check role authorization
  const role = profile.role as UserRole;
  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    role,
  };
}
