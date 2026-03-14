import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Channel type matching the CHECK constraint on the DB column.
 */
type Channel = "outbound" | "partner" | "inbound";

const ALL_CHANNELS: Channel[] = ["outbound", "partner", "inbound"];

/**
 * Aggregate per-channel metrics for a given month and upsert into `channel_metrics`.
 *
 * Data sources:
 *   - `customers` table: `lead_source` column for channel classification
 *   - `customer_snapshots`: per-customer MRR for the target month
 *   - `settings`: per-channel CAC if configured
 *
 * We compute:
 *   - new_logos: customers whose start_date falls within the target month
 *   - new_mrr: sum of MRR for new logos in that channel
 *   - pipeline/deal metrics: deferred until HubSpot source mapping is added
 *
 * @param month - YYYY-MM format
 */
export async function syncChannelMetrics(month: string): Promise<void> {
  console.log(`[sync-channel-metrics] Starting for ${month}`);

  const supabase = createAdminClient();

  // ── Fetch customers with their snapshots for this month ──────
  const { data: customers, error: custError } = await supabase
    .from("customers")
    .select("id, name, lead_source, partner, start_date, status");

  if (custError) {
    throw new Error(
      `[sync-channel-metrics] Failed to fetch customers: ${custError.message}`
    );
  }

  const { data: snapshots, error: snapError } = await supabase
    .from("customer_snapshots")
    .select("customer_id, mrr, status")
    .eq("month", month);

  if (snapError) {
    throw new Error(
      `[sync-channel-metrics] Failed to fetch snapshots: ${snapError.message}`
    );
  }

  // ── Fetch per-channel CAC from settings ──────────────────────
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("cac_outbound, cac_partner, cac_inbound")
    .eq("month", month)
    .maybeSingle();

  const cacByChannel: Record<Channel, number | null> = {
    outbound: settingsRow?.cac_outbound ?? null,
    partner: settingsRow?.cac_partner ?? null,
    inbound: settingsRow?.cac_inbound ?? null,
  };

  // ── Build lookup maps ────────────────────────────────────────
  const snapshotByCustomer = new Map(
    (snapshots ?? []).map((s) => [s.customer_id, s])
  );

  // Month boundaries for "new logo" detection
  const monthStart = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  // ── Aggregate per channel ────────────────────────────────────
  const channelData: Record<
    Channel,
    {
      newLogos: number;
      newMRR: number;
    }
  > = {
    outbound: { newLogos: 0, newMRR: 0 },
    partner: { newLogos: 0, newMRR: 0 },
    inbound: { newLogos: 0, newMRR: 0 },
  };

  for (const cust of customers ?? []) {
    // Determine channel: use lead_source if set, fall back to partner logic
    let channel: Channel = "outbound"; // default
    if (cust.lead_source && ALL_CHANNELS.includes(cust.lead_source as Channel)) {
      channel = cust.lead_source as Channel;
    } else if (cust.partner) {
      channel = "partner";
    }

    // Check if this customer is a new logo in this month
    const startDate = cust.start_date?.slice(0, 10);
    if (startDate && startDate >= monthStart && startDate <= monthEnd) {
      const snap = snapshotByCustomer.get(cust.id);
      channelData[channel].newLogos += 1;
      channelData[channel].newMRR += snap?.mrr ?? 0;
    }
  }

  // ── Upsert rows ──────────────────────────────────────────────
  const rows = ALL_CHANNELS.map((channel) => ({
    month,
    channel,
    new_logos: channelData[channel].newLogos,
    new_mrr: channelData[channel].newMRR,
    cac: cacByChannel[channel],
    // Pipeline metrics will be populated once HubSpot source mapping is added
    pipeline_value: null as number | null,
    deals_created: null as number | null,
    deals_won: null as number | null,
    deals_lost: null as number | null,
    win_rate: null as number | null,
    avg_deal_size: null as number | null,
    avg_sales_cycle_days: null as number | null,
  }));

  const { error: upsertError } = await supabase
    .from("channel_metrics")
    .upsert(rows, { onConflict: "month,channel" });

  if (upsertError) {
    throw new Error(
      `[sync-channel-metrics] Upsert failed: ${upsertError.message}`
    );
  }

  console.log(
    `[sync-channel-metrics] Synced ${rows.length} channel rows for ${month}: ` +
      ALL_CHANNELS.map(
        (ch) => `${ch}=${channelData[ch].newLogos} logos / ${channelData[ch].newMRR} MRR`
      ).join(", ")
  );
}
