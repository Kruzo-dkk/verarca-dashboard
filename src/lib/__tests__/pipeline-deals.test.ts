import { describe, it, expect } from "vitest";
import { buildStoredDeals, type HubSpotDeal } from "@/lib/hubspot";
import { buildHubSpotDeal } from "@/test/mocks/hubspot";

describe("buildStoredDeals", () => {
  it("produces the flat shape the Sales dashboard reads (no `properties` wrapper), with owner_id + probability", () => {
    const deals = [
      buildHubSpotDeal({
        dealname: "Acme",
        amount: "50000",
        amount_in_home_currency: "50000",
        dealstage: "stage-1",
        hubspot_owner_id: "owner-9",
        hs_deal_stage_probability: "0.4",
        days_to_close: "12",
      }),
    ] as unknown as HubSpotDeal[];

    const [d] = buildStoredDeals(deals, new Map([["stage-1", "Negotiation"]]));

    expect(d).toMatchObject({
      name: "Acme",
      stage: "stage-1",
      stage_label: "Negotiation",
      owner_id: "owner-9",
      probability: "0.4",
      amount: "50000",
    });
    // The exact regression that blanked the pipeline board: the reader expected
    // `deal.properties` but the writer never produced it.
    expect("properties" in (d as object)).toBe(false);
  });

  it("prefers amount_in_home_currency, falls back to amount, and to stage id when no label", () => {
    const deals = [
      buildHubSpotDeal({ amount: "100", amount_in_home_currency: null, dealstage: "s" }),
    ] as unknown as HubSpotDeal[];
    const [d] = buildStoredDeals(deals, new Map());
    expect(d.amount).toBe("100");
    expect(d.stage_label).toBe("s");
    expect(d.owner_id).toBeNull();
  });
});
