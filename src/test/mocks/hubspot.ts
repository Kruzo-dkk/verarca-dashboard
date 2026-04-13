/**
 * Build a test HubSpot deal with sensible defaults.
 */
export function buildHubSpotDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: `deal-${Math.random().toString(36).slice(2, 8)}`,
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
