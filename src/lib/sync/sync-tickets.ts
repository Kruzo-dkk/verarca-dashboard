import { fetchTickets } from "@/lib/hubspot-tickets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SyncModuleResult } from "@/lib/sync/types";

export async function syncTickets(month: string): Promise<SyncModuleResult> {
  console.log(`[sync-tickets] Starting ticket sync for ${month}`);

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString().split("T")[0];
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === mon;
  const endDate = isCurrentMonth
    ? now.toISOString().split("T")[0]
    : new Date(year, mon, 0).toISOString().split("T")[0];

  const tickets = await fetchTickets(startDate, endDate);
  console.log(`[sync-tickets] Fetched ${tickets.length} tickets`);

  const supabase = createAdminClient();

  // Build company → customer mapping
  const { data: customers } = await supabase
    .from("customers")
    .select("id, hubspot_company_id")
    .not("hubspot_company_id", "is", null);

  const companyToCustomer = new Map<string, number>();
  for (const c of customers ?? []) {
    if (c.hubspot_company_id) {
      companyToCustomer.set(c.hubspot_company_id, c.id);
    }
  }

  let upserted = 0;
  let ticketsWithCompany = 0;
  let ticketsWithoutCompany = 0;
  let customersResolved = 0;
  const unresolvedCompanyIdSet = new Set<string>();

  for (const ticket of tickets) {
    let customerId: number | null = null;

    if (ticket.companyId) {
      ticketsWithCompany++;
      const resolved = companyToCustomer.get(ticket.companyId) ?? null;
      if (resolved !== null) {
        customerId = resolved;
        customersResolved++;
      } else {
        unresolvedCompanyIdSet.add(ticket.companyId);
      }
    } else {
      ticketsWithoutCompany++;
    }

    const { error } = await supabase.from("ticket_snapshots").upsert(
      {
        month,
        customer_id: customerId,
        hubspot_ticket_id: ticket.ticketId,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        created_date: ticket.createdDate,
        closed_date: ticket.closedDate,
        resolution_time_hours: ticket.resolutionTimeHours,
        owner_id: ticket.ownerId,
      },
      { onConflict: "month,hubspot_ticket_id" },
    );

    if (error) {
      console.error(
        `[sync-tickets] Upsert failed for ticket ${ticket.ticketId}:`,
        error,
      );
      throw new Error(`[sync-tickets] Upsert failed: ${error.message}`);
    }
    upserted++;
  }

  const unresolvedCompanyIds = [...unresolvedCompanyIdSet].slice(0, 20);

  console.log(
    `[sync-tickets] Successfully synced ${upserted} tickets (${companyToCustomer.size} mapped companies)`,
  );

  return {
    recordsFetched: tickets.length,
    recordsUpserted: upserted,
    metadata: {
      ticketsWithCompany,
      ticketsWithoutCompany,
      customersResolved,
      mappedCompanies: companyToCustomer.size,
      unresolvedCompanyIds,
    },
  };
}
