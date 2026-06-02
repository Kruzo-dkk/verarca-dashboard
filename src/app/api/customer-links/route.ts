import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichSuggestions, type SuggestionRow } from "@/lib/customer-links";

/**
 * GET /api/customer-links
 *
 * Returns suggested (email/name) customer links awaiting manual review,
 * enriched with both members' names and status.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: links, error } = await supabase
      .from("customer_links")
      .select("id, canonical_handle, linked_handle, cvr, match_method, confidence")
      .eq("status", "suggested")
      .order("id", { ascending: true });

    if (error) {
      console.error("Failed to fetch suggested links:", error);
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
    }

    const rows = (links ?? []) as SuggestionRow[];
    const handles = [
      ...new Set(rows.flatMap((l) => [l.canonical_handle, l.linked_handle])),
    ];

    const { data: customers } = await supabase
      .from("customers")
      .select("frisbii_handle, name, status")
      .in("frisbii_handle", handles);

    const byHandle = new Map(
      (customers ?? []).map((c) => [c.frisbii_handle, { name: c.name, status: c.status }])
    );

    return NextResponse.json({ suggestions: enrichSuggestions(rows, byHandle) });
  } catch (error) {
    console.error("Failed to fetch suggested links:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
