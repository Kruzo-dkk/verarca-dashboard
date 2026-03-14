import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/auth/roles";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/users/[id] — Update a user's role (management only)
 *
 * Body: { role: string, displayName?: string }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireRole(["management"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json();

  // Prevent self-demotion (management user cannot change own role)
  if (id === auth.userId && body.role && body.role !== "management") {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  if (body.role && !isValidRole(body.role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: management, board, investor` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const updateData: Record<string, string> = { updated_at: new Date().toISOString() };
  if (body.role) updateData.role = body.role;
  if (body.displayName !== undefined) updateData.display_name = body.displayName;

  const { data, error } = await admin
    .from("user_profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

/**
 * DELETE /api/users/[id] — Remove a user (management only)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await requireRole(["management"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Prevent self-deletion
  if (id === auth.userId) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Delete from user_profiles (CASCADE will handle auth.users FK)
  const { error: profileError } = await admin
    .from("user_profiles")
    .delete()
    .eq("id", id);

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    );
  }

  // Also delete the auth user
  const { error: authError } = await admin.auth.admin.deleteUser(id);
  if (authError) {
    console.error("Failed to delete auth user:", authError.message);
    // Profile is already deleted, so we proceed
  }

  return NextResponse.json({ message: "User removed" });
}
