import { describe, it, expect } from "vitest";
import { buildStoredDeals, type HubSpotDeal, type PipelineStage } from "@/lib/hubspot";
import { buildHubSpotDeal } from "@/test/mocks/hubspot";

const STAGES: PipelineStage[] = [
  { stageId: "stage-1", label: "Negotiation", displayOrder: 1, probability: 0.4, isClosed: false },
  { stageId: "won-1", label: "Vundet", displayOrder: 2, probability: 1, isClosed: true },
  { stageId: "lost-1", label: "Tabt", displayOrder: 3, probability: 0, isClosed: true },
];

describe("buildStoredDeals", () => {
  it("produces the flat shape the Sales dashboard reads (no `properties` wrapper), with label, numeric probability, owner_id, open classification", () => {
    const deals = [
      buildHubSpotDeal({
        dealname: "Acme",
        amount: "50000",
        amount_in_home_currency: "50000",
        dealstage: "stage-1",
        hubspot_owner_id: "owner-9",
        days_to_close: "12",
      }),
    ] as unknown as HubSpotDeal[];

    const [d] = buildStoredDeals(deals, STAGES);

    expect(d).toMatchObject({
      name: "Acme",
      stage: "stage-1",
      stage_label: "Negotiation",
      owner_id: "owner-9",
      probability: 0.4,
      amount: "50000",
      is_closed: false,
      is_won: false,
    });
    // The regression that blanked the pipeline board: the reader expected
    // `deal.properties` but the writer never produced it.
    expect("properties" in (d as object)).toBe(false);
  });

  it("stamps is_closed/is_won from the stage so the reader needs no live HubSpot call (Vundet = won, Tabt = lost)", () => {
    const deals = [
      buildHubSpotDeal({ dealname: "Won deal", dealstage: "won-1", amount: "1000" }),
      buildHubSpotDeal({ dealname: "Lost deal", dealstage: "lost-1", amount: "2000" }),
    ] as unknown as HubSpotDeal[];

    const [won, lost] = buildStoredDeals(deals, STAGES);
    expect(won).toMatchObject({ stage_label: "Vundet", is_closed: true, is_won: true, probability: 1 });
    expect(lost).toMatchObject({ stage_label: "Tabt", is_closed: true, is_won: false, probability: 0 });
  });

  it("falls back to stage id label and the deal's own probability when the stage is unknown", () => {
    const deals = [
      buildHubSpotDeal({
        amount: "100",
        amount_in_home_currency: null,
        dealstage: "s",
        hs_deal_stage_probability: "0.3",
      }),
    ] as unknown as HubSpotDeal[];
    const [d] = buildStoredDeals(deals, []);
    expect(d.amount).toBe("100");
    expect(d.stage_label).toBe("s");
    expect(d.owner_id).toBeNull();
    expect(d.is_closed).toBe(false);
    expect(d.is_won).toBe(false);
    expect(d.probability).toBe(0.3);
  });

  it("carries createdate and last-modified date through to the stored deal", () => {
    const deals = [
      buildHubSpotDeal({
        dealstage: "stage-1",
        createdate: "2026-01-10T08:00:00Z",
        hs_lastmodifieddate: "2026-03-02T10:00:00Z",
      }),
    ] as unknown as HubSpotDeal[];

    const [d] = buildStoredDeals(deals, STAGES);
    expect(d.createdate).toBe("2026-01-10T08:00:00Z");
    expect(d.updateddate).toBe("2026-03-02T10:00:00Z");
  });

  it("coalesces missing createdate/last-modified to null", () => {
    const deals = [
      buildHubSpotDeal({ dealstage: "stage-1" }),
    ] as unknown as HubSpotDeal[];

    const [d] = buildStoredDeals(deals, STAGES);
    expect(d.createdate).toBeNull();
    expect(d.updateddate).toBeNull();
  });
});
