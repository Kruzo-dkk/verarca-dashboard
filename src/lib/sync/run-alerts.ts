import { createAdminClient } from "@/lib/supabase/admin";
import { detectAlerts, type Alert, type ChurnedCustomerLite } from "@/lib/alerts";
import { syncLog } from "./logger";

function monthsAgo(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getResend() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Resend } = require("resend") as { Resend: new (key?: string) => import("resend").Resend };
  return new Resend(process.env.RESEND_API_KEY);
}

function recipients(): string[] {
  return (process.env.ALERT_RECIPIENTS || "thomas@andersens.nu")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Detect threshold-alert breaches for `month`, persist new ones to alert_events
 * (deduped on month+rule), and email the newly-detected ones. Best-effort: an
 * email/DB failure never throws into the cron.
 */
export async function runAlertChecks(
  month: string
): Promise<{ detected: number; emailed: number }> {
  try {
    const supabase = createAdminClient();
    const prevMonth = monthsAgo(month, 1);

    const { data: snaps } = await supabase
      .from("monthly_snapshots")
      .select("month, mrr, nrr, churned_mrr_event")
      .gte("month", monthsAgo(month, 3))
      .lte("month", month)
      .order("month", { ascending: true });

    const cur = (snaps ?? []).find((s) => s.month === month);
    if (!cur) return { detected: 0, emailed: 0 };
    const prev = (snaps ?? []).find((s) => s.month === prevMonth);
    const trailing = (snaps ?? []).filter((s) => s.month !== month);
    const churnAvg3mo = trailing.length
      ? trailing.reduce((a, s) => a + (s.churned_mrr_event ?? 0), 0) / trailing.length
      : null;

    // Customers who churned this month, with their last-active MRR.
    const lo = `${month}-01`;
    const hi = `${month}-31`;
    const { data: churnedRows } = await supabase
      .from("customers")
      .select("id, frisbii_handle, name, company_name, churn_date, status")
      .gte("churn_date", lo)
      .lte("churn_date", hi)
      .eq("excluded", false)
      .neq("status", "active");

    let churnedCustomers: ChurnedCustomerLite[] = [];
    if (churnedRows && churnedRows.length > 0) {
      const ids = churnedRows.map((c) => c.id);
      const { data: snapMrr } = await supabase
        .from("customer_snapshots")
        .select("customer_id, mrr")
        .in("customer_id", ids)
        .in("month", [prevMonth, month]);
      const maxMrr = new Map<number, number>();
      for (const s of snapMrr ?? []) {
        maxMrr.set(s.customer_id, Math.max(maxMrr.get(s.customer_id) ?? 0, s.mrr));
      }
      churnedCustomers = churnedRows.map((c) => ({
        handle: c.frisbii_handle,
        name: c.company_name || c.name,
        mrr: maxMrr.get(c.id) ?? 0,
      }));
    }

    const alerts: Alert[] = detectAlerts({
      month,
      current: { mrr: cur.mrr, nrr: cur.nrr, churnedMrrEvent: cur.churned_mrr_event ?? 0 },
      prevMrr: prev?.mrr ?? null,
      churnAvg3mo,
      churnedCustomers,
    });
    if (alerts.length === 0) return { detected: 0, emailed: 0 };

    // Insert only new (month,rule) rows — ignoreDuplicates returns just the inserted.
    const { data: inserted } = await supabase
      .from("alert_events")
      .upsert(
        alerts.map((a) => ({ month, rule: a.rule, severity: a.severity, message: a.message })),
        { onConflict: "month,rule", ignoreDuplicates: true }
      )
      .select("id, rule, severity, message");

    const fresh = inserted ?? [];
    if (fresh.length === 0) return { detected: alerts.length, emailed: 0 };

    // Email the fresh breaches.
    let emailed = 0;
    try {
      const resend = getResend();
      const lines = fresh
        .map((a) => `• [${a.severity.toUpperCase()}] ${a.message}`)
        .join("<br>");
      const { error } = await resend.emails.send({
        from: "Verarca Alerts <reports@verarca.dk>",
        to: recipients(),
        subject: `⚠️ Verarca metric alerts — ${month} (${fresh.length})`,
        html: `<p>Følgende tærskler blev brudt i ${month}:</p><p>${lines}</p><p style="color:#888;font-size:12px">Se Data Quality-dashboardet for detaljer.</p>`,
      });
      if (error) {
        syncLog.error("[alerts] email failed:", error);
      } else {
        emailed = fresh.length;
        await supabase
          .from("alert_events")
          .update({ emailed_at: new Date().toISOString() })
          .in(
            "id",
            fresh.map((a) => a.id)
          );
      }
    } catch (err) {
      syncLog.error("[alerts] email send threw:", err);
    }

    return { detected: alerts.length, emailed };
  } catch (err) {
    syncLog.error("[alerts] runAlertChecks failed:", err);
    return { detected: 0, emailed: 0 };
  }
}
