import { getReportData } from "@/lib/report-data";
import { buildReportEmailHTML } from "@/lib/email-builder";
import type { Currency } from "@/lib/currency";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function formatMonthLabel(month: string): string {
  const [year, mo] = month.split("-");
  return `${MONTH_NAMES[parseInt(mo!, 10) - 1]} ${year}`;
}

/** The calendar month before `month` (YYYY-MM), e.g. "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getResend() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend") as { Resend: new (key?: string) => import("resend").Resend };
  return new Resend(process.env.RESEND_API_KEY);
}

/**
 * Build the M&A report for `month` and email it via Resend. Shared by the
 * on-demand POST /api/report/email route and the scheduled digest cron.
 */
export async function sendReportEmail(
  month: string,
  currency: Currency,
  recipients: string[]
): Promise<{ id: string | undefined }> {
  const reportData = await getReportData(month, month, currency);
  const html = await buildReportEmailHTML(reportData, month, currency, reportData.fxRates);

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: "Verarca Reports <reports@verarca.dk>",
    to: recipients,
    subject: `Verarca M&A Report — ${formatMonthLabel(month)}`,
    html,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}
