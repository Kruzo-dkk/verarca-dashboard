import { NextResponse } from "next/server";
import { backfillHistory } from "@/lib/sync/backfill-history";

export const maxDuration = 300; // 5 minutes — backfill can take a while

export async function GET(request: Request) {
  // ── Auth: same pattern as /api/cron/snapshot ───────────────────
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const url = new URL(request.url);
    // `?endMonth=YYYY-MM` pins the last month; `?through=current` rebuilds up to
    // and including the current month (the daily full-rebuild safety net). With
    // neither, backfillHistory defaults to the previous month.
    const endMonthParam = url.searchParams.get("endMonth") ?? undefined;
    const through = url.searchParams.get("through");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const endMonth = endMonthParam ?? (through === "current" ? currentMonth : undefined);

    const result = await backfillHistory(endMonth);

    return NextResponse.json({
      message: "Backfill complete",
      ...result,
    });
  } catch (error) {
    console.error("[backfill] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Backfill failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
