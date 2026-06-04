import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderPagePdf } from "@/lib/pdf/render-pdf";
import { isValidMonth } from "@/lib/report-email";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/report/pdf?month=YYYY-MM&currency=DKK
 *
 * Renders the Board Report view to a real PDF with headless Chromium and
 * streams it as a download. Requires an authenticated session — the caller's
 * cookies are forwarded to the headless browser.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams, origin } = new URL(request.url);
    const month = searchParams.get("month") ?? getCurrentMonth();
    const currency = searchParams.get("currency") ?? "DKK";
    if (!isValidMonth(month)) {
      return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    }

    const target = new URL("/", origin);
    target.searchParams.set("view", "board");
    target.searchParams.set("month", month);
    if (currency !== "DKK") target.searchParams.set("currency", currency);

    const pdf = await renderPagePdf({
      url: target.toString(),
      cookie: request.headers.get("cookie"),
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="verarca-board-${month}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to render board PDF:", error);
    return NextResponse.json({ error: "Failed to render PDF" }, { status: 500 });
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
