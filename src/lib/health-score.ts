export interface HealthScoreInput {
  mrrHistory: { month: string; mrr: number }[]; // last 6 months, newest first
  tier: string | null; // "Managed" | "Standard" | null
  monthsAsCustomer: number;
  daysSinceLastActivity: number | null;
  openTickets: number;
}

export interface HealthScoreResult {
  score: number; // 0-100
  label: "healthy" | "neutral" | "at_risk";
  factors: string[];
}

export function computeHealthScore(
  input: HealthScoreInput,
): HealthScoreResult {
  const factors: string[] = [];

  // -- MRR Trend (30%) --
  let mrrScore = 50; // default for insufficient data
  if (input.mrrHistory.length >= 2) {
    const current = input.mrrHistory[0]?.mrr ?? 0;
    // Baseline = the OLDEST month in which the customer actually had MRR.
    // Anchoring on the literal oldest slot scores every recently-joined customer
    // as "flat" (their first months are 0), which made the Healthy bucket
    // structurally impossible. mrrHistory is newest-first, so reverse to scan
    // oldest→newest.
    const oldest = [...input.mrrHistory].reverse().find((s) => s.mrr > 0)?.mrr ?? 0;
    if (oldest > 0) {
      const change = (current - oldest) / oldest;
      if (change > 0.05) {
        mrrScore = 100;
        factors.push("MRR expanding");
      } else if (change >= -0.05) {
        mrrScore = 50;
        factors.push("MRR flat");
      } else {
        mrrScore = 0;
        factors.push("MRR declining");
      }
    }
  } else {
    factors.push("Insufficient MRR history");
  }

  // -- Activity Recency (25%) --
  let activityScore = 50;
  if (input.daysSinceLastActivity !== null) {
    if (input.daysSinceLastActivity <= 7) {
      activityScore = 100;
    } else if (input.daysSinceLastActivity <= 30) {
      activityScore = 70;
      factors.push("No activity in 7+ days");
    } else if (input.daysSinceLastActivity <= 60) {
      activityScore = 30;
      factors.push("No activity in 30+ days");
    } else {
      activityScore = 0;
      factors.push("No activity in 60+ days");
    }
  } else {
    factors.push("No activity data");
  }

  // -- Tenure (15%) --
  let tenureScore: number;
  if (input.monthsAsCustomer >= 24) {
    tenureScore = 100;
  } else if (input.monthsAsCustomer >= 12) {
    tenureScore = 75;
  } else if (input.monthsAsCustomer >= 6) {
    tenureScore = 50;
  } else {
    tenureScore = 25;
    factors.push("New customer (<6 months)");
  }

  // -- Ticket Burden (15%) --
  let ticketScore: number;
  if (input.openTickets === 0) {
    ticketScore = 100;
  } else if (input.openTickets <= 2) {
    ticketScore = 70;
    factors.push(`${input.openTickets} open ticket(s)`);
  } else if (input.openTickets <= 5) {
    ticketScore = 30;
    factors.push(`${input.openTickets} open tickets`);
  } else {
    ticketScore = 0;
    factors.push(`${input.openTickets} open tickets — high burden`);
  }

  // -- Tier (15%) --
  let tierScore: number;
  if (input.tier === "Managed") {
    tierScore = 100;
  } else if (input.tier === "Standard") {
    tierScore = 50;
  } else {
    tierScore = 30;
    factors.push("No service tier assigned");
  }

  // -- Weighted total --
  const score = Math.round(
    mrrScore * 0.3 +
      activityScore * 0.25 +
      tenureScore * 0.15 +
      ticketScore * 0.15 +
      tierScore * 0.15,
  );

  const label: HealthScoreResult["label"] =
    score >= 70 ? "healthy" : score >= 40 ? "neutral" : "at_risk";

  return { score, label, factors };
}
