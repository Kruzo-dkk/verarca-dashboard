/**
 * Threshold-alert detection. Pure: takes the current/previous monthly snapshot
 * plus the churned customers, returns the breaches. The daily cron persists new
 * ones to alert_events and emails them.
 */

export interface AlertSnapshot {
  mrr: number;
  nrr: number | null;
  churnedMrrEvent: number;
}

export interface ChurnedCustomerLite {
  handle: string;
  name: string;
  mrr: number; // øre
}

export interface AlertInput {
  month: string;
  current: AlertSnapshot;
  prevMrr: number | null;
  /** Average event-based churned MRR over the trailing 3 months (excl. current). */
  churnAvg3mo: number | null;
  churnedCustomers: ChurnedCustomerLite[];
}

export interface Alert {
  rule: string;
  severity: "warn" | "critical";
  message: string;
}

// Tunable thresholds.
export const ALERT_THRESHOLDS = {
  mrrDropPct: 0.02, // >2% MoM MRR drop = critical (any drop = warn)
  churnSpikeMultiple: 1.5, // current churn > 1.5× trailing-3mo avg
  bigCustomerMrr: 500_000, // øre = kr 5.000/mo — a "big" customer
};

const kr = (ore: number) => `kr ${Math.round(ore / 100).toLocaleString("da-DK")}`;

export function detectAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  const { current, prevMrr, churnAvg3mo, churnedCustomers, month } = input;

  // 1. MRR drop month-over-month
  if (prevMrr != null && current.mrr < prevMrr) {
    const dropPct = (prevMrr - current.mrr) / prevMrr;
    alerts.push({
      rule: "mrr_drop",
      severity: dropPct >= ALERT_THRESHOLDS.mrrDropPct ? "critical" : "warn",
      message: `MRR faldt ${(dropPct * 100).toFixed(1)}% i ${month} (${kr(prevMrr)} → ${kr(current.mrr)}).`,
    });
  }

  // 2. Churn spike vs trailing-3mo average
  if (
    churnAvg3mo != null &&
    churnAvg3mo > 0 &&
    current.churnedMrrEvent > churnAvg3mo * ALERT_THRESHOLDS.churnSpikeMultiple
  ) {
    alerts.push({
      rule: "churn_spike",
      severity: "critical",
      message: `Churn-spike i ${month}: ${kr(current.churnedMrrEvent)} mistet vs. 3-mdr-snit ${kr(Math.round(churnAvg3mo))}.`,
    });
  }

  // 3. NRR below 100%
  if (current.nrr != null && current.nrr < 100) {
    alerts.push({
      rule: "nrr_below_100",
      severity: current.nrr < 95 ? "critical" : "warn",
      message: `NRR under 100% i ${month}: ${current.nrr.toFixed(1)}% — netto-krympning på eksisterende kunder.`,
    });
  }

  // 4. A big customer churned
  for (const c of churnedCustomers) {
    if (c.mrr >= ALERT_THRESHOLDS.bigCustomerMrr) {
      alerts.push({
        rule: `big_customer_churn:${c.handle}`,
        severity: "critical",
        message: `Stor kunde churnet i ${month}: ${c.name} (${kr(c.mrr)}/md).`,
      });
    }
  }

  return alerts;
}
