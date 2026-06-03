import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReportEmail, isValidMonth } from "@/lib/report-email";
import type { Currency } from "@/lib/currency";

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

    const { id } = await sendReportEmail(month, currency, body.recipients);

    return NextResponse.json({
      message: "Report email sent",
      id,
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

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
