import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReportEmail, previousMonth } from "@/lib/report-email";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function recipients(): string[] {
  return (process.env.DIGEST_RECIPIENTS || process.env.ALERT_RECIPIENTS || "thomas@andersens.nu")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * GET /api/cron/send-digest
 *
 * Scheduled monthly: emails the previous month's M&A report to the digest
 * recipients. Deduped via digest_sends.unique(month) so re-fires (or the
 * 15-min snapshot cron sharing the day) never double-send.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const month = previousMonth(getCurrentMonth());
  const to = recipients();
  const supabase = createAdminClient();

  // Claim the month first so a concurrent/duplicate run can't double-send.
  const { data: claimed, error: claimError } = await supabase
    .from("digest_sends")
    .upsert(
      { month, recipients: to.join(",") },
      { onConflict: "month", ignoreDuplicates: true }
    )
    .select("id");

  if (claimError) {
    console.error("[send-digest] claim failed:", claimError);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ message: "already sent", month, skipped: true });
  }

  try {
    const { id } = await sendReportEmail(month, "DKK", to);
    await supabase.from("digest_sends").update({ resend_id: id }).eq("month", month);
    return NextResponse.json({ message: "digest sent", month, recipients: to, id });
  } catch (err) {
    // Release the claim so the next run can retry.
    await supabase.from("digest_sends").delete().eq("month", month);
    console.error("[send-digest] send failed:", err);
    return NextResponse.json({ error: "send failed", month }, { status: 500 });
  }
}
