import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReportData } from "@/lib/report-data";
import { buildReportEmailHTML } from "@/lib/email-builder";
import type { Currency } from "@/lib/currency";

function getResend() {
  const { Resend } = require("resend") as { Resend: new (key?: string) => import("resend").Resend };
  return new Resend(process.env.RESEND_API_KEY);
}

interface EmailRequestBody {
  month?: string;
  currency?: Currency;
  recipients: string[];
}

/**
 * POST /api/report/email
 *
 * Generates and sends the M&A performance report as an HTML email.
 * Requires authentication and a list of recipients.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as EmailRequestBody;

    if (!body.recipients?.length) {
      return NextResponse.json(
        { error: "At least one recipient is required" },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = body.recipients.filter((e) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email addresses: ${invalidEmails.join(", ")}` },
        { status: 400 }
      );
    }

    const month = body.month ?? getCurrentMonth();
    const currency = body.currency ?? "DKK";

    if (!isValidMonth(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Expected YYYY-MM." },
        { status: 400 }
      );
    }

    // Build report data
    const reportData = await getReportData(month, month, currency);

    // Build HTML
    const html = await buildReportEmailHTML(
      reportData,
      month,
      currency,
      reportData.fxRates
    );

    // Send via Resend
    const monthLabel = formatMonthLabel(month);
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: "Verarca Reports <reports@verarca.dk>",
      to: body.recipients,
      subject: `Verarca M&A Report — ${monthLabel}`,
      html,
    });

    if (error) {
      console.error("Failed to send report email:", error);
      return NextResponse.json(
        { error: "Failed to send email", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Report email sent",
      id: data?.id,
      recipients: body.recipients,
      month,
      currency,
    });
  } catch (error) {
    console.error("Failed to send report email:", error);
    return NextResponse.json(
      { error: "Failed to send report email" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function formatMonthLabel(month: string): string {
  const [year, mo] = month.split("-");
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${names[parseInt(mo!) - 1]} ${year}`;
}
