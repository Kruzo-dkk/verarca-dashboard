import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDefaultRoute, type UserRole } from "@/lib/auth/roles";

/**
 * GET /invite/accept?token=xxx
 *
 * Called when a user clicks the invitation link in their email.
 * The user has already been created via Supabase Auth's inviteUserByEmail.
 * This handler:
 * 1. Validates the invitation token
 * 2. Creates the user_profiles row with the assigned role
 * 3. Marks the invitation as accepted
 * 4. Redirects to the appropriate dashboard
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  if (!token) {
    return NextResponse.redirect(`${siteUrl}/login?error=Missing+invitation+token`);
  }

  const admin = createAdminClient();

  // 1. Look up the invitation
  const { data: invitation, error } = await admin
    .from("invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invitation) {
    return NextResponse.redirect(
      `${siteUrl}/login?error=Invalid+or+expired+invitation`
    );
  }

  // 2. Check expiry
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.redirect(
      `${siteUrl}/login?error=Invitation+has+expired`
    );
  }

  // 3. Find the auth user by email (created by inviteUserByEmail)
  const { data: userList } = await admin.auth.admin.listUsers();
  const authUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
  );

  if (!authUser) {
    return NextResponse.redirect(
      `${siteUrl}/login?error=User+account+not+found.+Please+try+logging+in+first.`
    );
  }

  // 4. Create user_profiles row
  const role = invitation.role as UserRole;
  await admin.from("user_profiles").upsert({
    id: authUser.id,
    email: invitation.email,
    display_name: authUser.user_metadata?.display_name ?? null,
    role,
    invited_by: invitation.invited_by,
    invited_at: invitation.created_at,
  });

  // 5. Mark invitation as accepted
  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  // 6. Redirect to login (user will complete auth flow and then be routed by role)
  return NextResponse.redirect(`${siteUrl}/login?message=Invitation+accepted.+Sign+in+to+continue.`);
}
