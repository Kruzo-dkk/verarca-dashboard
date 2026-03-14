import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRole } from "@/lib/auth/roles";

/**
 * GET /api/users — List all users with profiles (management only)
 */
export async function GET() {
  const auth = await requireRole(["management"]);
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();

  // Fetch all profiles
  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch pending invitations
  const { data: invitations } = await admin
    .from("invitations")
    .select("*")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    users: profiles ?? [],
    pendingInvitations: invitations ?? [],
  });
}

/**
 * POST /api/users — Invite a new user (management only)
 *
 * Body: { email: string, role: string, displayName?: string }
 */
export async function POST(request: Request) {
  const auth = await requireRole(["management"]);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { email, role, displayName } = body;

  if (!email || !role) {
    return NextResponse.json(
      { error: "email and role are required" },
      { status: 400 }
    );
  }

  if (!isValidRole(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: management, board, investor` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Check if user already exists
  const { data: existing } = await admin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  // Check for existing pending invitation
  const { data: existingInvite } = await admin
    .from("invitations")
    .select("id")
    .eq("email", email)
    .is("accepted_at", null)
    .single();

  if (existingInvite) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email" },
      { status: 409 }
    );
  }

  // Create invitation record
  const { data: invitation, error: inviteError } = await admin
    .from("invitations")
    .insert({
      email,
      role,
      invited_by: auth.userId,
    })
    .select()
    .single();

  if (inviteError) {
    return NextResponse.json(
      { error: inviteError.message },
      { status: 500 }
    );
  }

  // Invite user via Supabase Auth (sends magic link email)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  const redirectTo = siteUrl
    ? `${siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`}/invite/accept?token=${invitation.token}`
    : undefined;

  const { error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      display_name: displayName ?? "",
      role,
      invitation_token: invitation.token,
    },
  });

  if (authError) {
    // Clean up invitation if auth invite fails
    await admin.from("invitations").delete().eq("id", invitation.id);
    return NextResponse.json(
      { error: `Failed to send invitation: ${authError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Invitation sent to ${email}`,
    invitation,
  });
}
