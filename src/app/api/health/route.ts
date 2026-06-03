import { NextResponse } from "next/server";
import { checkEnv } from "@/lib/env-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — reports whether required env vars are present (presence
 * only, never values). 200 when all required are set, 503 otherwise.
 */
export function GET() {
  const r = checkEnv();
  return NextResponse.json(
    {
      status: r.ok ? "ok" : "degraded",
      requiredMissing: r.requiredMissing,
      integrationsMissing: r.integrationsMissing,
    },
    { status: r.ok ? 200 : 503 }
  );
}
