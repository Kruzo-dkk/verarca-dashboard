import { NextRequest, NextResponse } from "next/server";
import { syncActivities } from "@/lib/sync/sync-activities";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    await syncActivities(month);
    return NextResponse.json({
      ok: true,
      month,
      durationMs: Date.now() - start,
    });
  } catch (error) {
    console.error("[sync-activities] Cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
