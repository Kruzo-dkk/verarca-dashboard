import type { ReportData } from "@/lib/types/report";
import type { Currency, FXRates } from "@/lib/currency";

/**
 * Renders the ReportEmail component to a self-contained HTML string
 * suitable for sending via email.
 *
 * Uses dynamic imports to avoid Turbopack's restriction on
 * importing react-dom/server in App Router static analysis.
 */
export async function buildReportEmailHTML(
  data: ReportData,
  month: string,
  currency: Currency,
  fxRates: FXRates
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createElement } = await import("react");
  const { ReportEmail } = await import("@/components/email/ReportEmail");

  const markup = renderToStaticMarkup(
    createElement(ReportEmail, { data, month, currency, fxRates })
  );

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n${markup}`;
}
