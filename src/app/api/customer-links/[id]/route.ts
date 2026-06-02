import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidLinkDecision } from "@/lib/customer-links";

/**
 * PATCH /api/customer-links/[id]
 *
 * Confirm or reject a suggested customer link. Confirmed links start affecting
 * metrics at the next sync. Records the reviewer in created_by.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const linkId = parseInt(id, 10);
    if (isNaN(linkId)) {
      return NextResponse.json({ error: "Invalid link ID" }, { status: 400 });
    }

    const body = await request.json();
    if (!isValidLinkDecision(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'confirmed' or 'rejected'." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("customer_links")
      .update({
        status: body.status,
        created_by: user.email ?? "unknown",
        updated_at: new Date().toISOString(),
      })
      .eq("id", linkId);

    if (error) {
      console.error("Failed to update customer link:", error);
      return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    console.error("Failed to update customer link:", error);
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
  }
}
