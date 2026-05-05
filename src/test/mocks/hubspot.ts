import type { SyncStatus } from "@/lib/sync/types";

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Build a test HubSpot deal with sensible defaults.
 */
export function buildHubSpotDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId("deal"),
    properties: {
      dealname: "Test Deal",
      amount: "50000",
      dealstage: "contractsent",
      pipeline: "default",
      closedate: "2026-06-01T00:00:00Z",
      ...overrides,
    },
  };
}

/**
 * Build a test HubSpot pipeline stage.
 */
export function buildPipelineStage(overrides: Record<string, unknown> = {}) {
  return {
    stageId: "contractsent",
    label: "Contract Sent",
    displayOrder: 3,
    metadata: { probability: "0.8" },
    ...overrides,
  };
}

/**
 * Build a test HubSpot company with sensible defaults.
 */
export function buildHubSpotCompany(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) ?? nextId("company");
  const props = { ...overrides };
  delete props.id;
  return {
    id,
    properties: {
      name: "Acme ApS",
      domain: "acme.dk",
      website: "https://acme.dk",
      cvr_nummer: null,
      organisationsnummer: null,
      ...props,
    },
  };
}

/**
 * Build a test HubSpot owner.
 */
export function buildHubSpotOwner(overrides: Partial<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}> = {}) {
  return {
    id: nextId("owner"),
    firstName: "Test",
    lastName: "Owner",
    email: "test.owner@verarca.dk",
    ...overrides,
  };
}

/**
 * Build a test HubSpot ticket (TicketWithCompany shape) with sensible defaults.
 */
export function buildHubSpotTicket(overrides: Partial<{
  ticketId: string;
  subject: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  createdDate: string | null;
  closedDate: string | null;
  resolutionTimeHours: number | null;
  ownerId: string | null;
  companyId: string | null;
}> = {}) {
  return {
    ticketId: nextId("ticket"),
    subject: "Test Ticket Subject",
    status: "1",
    priority: "MEDIUM",
    category: "BILLING",
    createdDate: "2026-05-01T10:00:00.000Z",
    closedDate: null,
    resolutionTimeHours: null,
    ownerId: "owner-123",
    companyId: null,
    ...overrides,
  };
}

/**
 * Build a sync_runs row for tests. Matches the migration schema.
 */
export function buildSyncRun(overrides: Partial<{
  id: number;
  module: string;
  month: string | null;
  started_at: string;
  finished_at: string | null;
  status: SyncStatus;
  records_fetched: number | null;
  records_upserted: number | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}> = {}) {
  const startedAt = overrides.started_at ?? new Date().toISOString();
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
    module: "pipeline",
    month: "2026-05",
    started_at: startedAt,
    finished_at: startedAt,
    status: "success" as SyncStatus,
    records_fetched: 0,
    records_upserted: 0,
    duration_ms: 0,
    error_message: null,
    metadata: null,
    ...overrides,
  };
}
