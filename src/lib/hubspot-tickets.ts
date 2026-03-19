import { hubspotFetch, hubspotPost } from "./hubspot";

export interface HubSpotTicket {
  id: string;
  properties: {
    subject: string | null;
    hs_pipeline_stage: string | null;
    hs_ticket_priority: string | null;
    hs_ticket_category: string | null;
    createdate: string | null;
    closed_date: string | null;
    time_to_close: string | null;
    hubspot_owner_id: string | null;
  };
  associations?: {
    companies?: { results: Array<{ id: string }> };
  };
}

export interface TicketWithCompany {
  ticketId: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  createdDate: string | null;
  closedDate: string | null;
  resolutionTimeHours: number | null;
  ownerId: string | null;
  companyId: string | null; // HubSpot company ID
}

export async function fetchTickets(
  startDate: string,
  endDate: string,
): Promise<TicketWithCompany[]> {
  const startDateMs = new Date(startDate).getTime().toString();
  const endDateMs = new Date(endDate).getTime().toString();

  const all: TicketWithCompany[] = [];
  let after: string | undefined;

  while (true) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "createdate",
              operator: "GTE",
              value: startDateMs,
            },
            {
              propertyName: "createdate",
              operator: "LTE",
              value: endDateMs,
            },
          ],
        },
      ],
      properties: [
        "subject",
        "hs_pipeline_stage",
        "hs_ticket_priority",
        "hs_ticket_category",
        "createdate",
        "closed_date",
        "time_to_close",
        "hubspot_owner_id",
      ],
      associations: ["companies"],
      limit: 100,
    };

    if (after) {
      body.after = after;
    }

    const data = await hubspotPost<{
      results: HubSpotTicket[];
      paging?: { next?: { after: string } };
    }>("/objects/tickets/search", body);

    for (const ticket of (data.results ?? [])) {
      const ttcRaw = ticket.properties.time_to_close;
      let resolutionTimeHours: number | null = null;
      if (ttcRaw) {
        const ms = parseFloat(ttcRaw);
        if (!isNaN(ms)) {
          resolutionTimeHours = Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
        }
      }

      all.push({
        ticketId: ticket.id,
        subject: ticket.properties.subject,
        status: ticket.properties.hs_pipeline_stage,
        priority: ticket.properties.hs_ticket_priority,
        category: ticket.properties.hs_ticket_category,
        createdDate: ticket.properties.createdate,
        closedDate: ticket.properties.closed_date,
        resolutionTimeHours,
        ownerId: ticket.properties.hubspot_owner_id,
        companyId:
          ticket.associations?.companies?.results?.[0]?.id ?? null,
      });
    }

    after = data.paging?.next?.after;
    if (!after) break;
  }

  return all;
}
