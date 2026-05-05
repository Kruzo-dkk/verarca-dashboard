import { describe, it, expect } from "vitest";
import {
  buildHubSpotDeal,
  buildPipelineStage,
  buildHubSpotCompany,
  buildHubSpotOwner,
  buildSyncRun,
  buildHubSpotTicket,
} from "../hubspot";

describe("hubspot mock builders", () => {
  describe("buildHubSpotCompany", () => {
    it("returns sensible defaults", () => {
      const company = buildHubSpotCompany();
      expect(company.id).toMatch(/^company-/);
      expect(company.properties.name).toBeTruthy();
      expect(company.properties.domain).toBeTruthy();
    });

    it("merges property overrides", () => {
      const company = buildHubSpotCompany({ name: "Acme A/S", cvr_nummer: "12345678" });
      expect(company.properties.name).toBe("Acme A/S");
      expect(company.properties.cvr_nummer).toBe("12345678");
    });

    it("generates unique ids per call", () => {
      const a = buildHubSpotCompany();
      const b = buildHubSpotCompany();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("buildHubSpotOwner", () => {
    it("returns sensible defaults", () => {
      const owner = buildHubSpotOwner();
      expect(owner.id).toMatch(/^owner-/);
      expect(owner.firstName).toBeTruthy();
      expect(owner.lastName).toBeTruthy();
      expect(owner.email).toMatch(/@/);
    });

    it("merges overrides", () => {
      const owner = buildHubSpotOwner({ firstName: "Thomas", email: "thomas@verarca.dk" });
      expect(owner.firstName).toBe("Thomas");
      expect(owner.email).toBe("thomas@verarca.dk");
    });
  });

  describe("buildSyncRun", () => {
    it("returns row matching sync_runs schema", () => {
      const run = buildSyncRun();
      expect(run.module).toBeTruthy();
      expect(run.status).toMatch(/^(running|success|failed|skipped)$/);
      expect(typeof run.records_upserted).toBe("number");
      expect(run.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("merges overrides", () => {
      const run = buildSyncRun({
        module: "pipeline",
        status: "failed",
        error_message: "API token invalid",
      });
      expect(run.module).toBe("pipeline");
      expect(run.status).toBe("failed");
      expect(run.error_message).toBe("API token invalid");
    });

    it("retains existing buildHubSpotDeal and buildPipelineStage builders", () => {
      expect(buildHubSpotDeal().properties.dealname).toBeTruthy();
      expect(buildPipelineStage().label).toBeTruthy();
    });
  });

  describe("buildHubSpotTicket", () => {
    it("returns sensible defaults", () => {
      const ticket = buildHubSpotTicket();
      expect(ticket.ticketId).toMatch(/^ticket-/);
      expect(ticket.subject).toBeTruthy();
      expect(ticket.status).toBeTruthy();
      expect(ticket.priority).toBeTruthy();
      expect(ticket.companyId).toBeNull();
      expect(ticket.closedDate).toBeNull();
      expect(ticket.resolutionTimeHours).toBeNull();
    });

    it("merges overrides", () => {
      const ticket = buildHubSpotTicket({
        subject: "Custom Subject",
        companyId: "hs-company-42",
        priority: "HIGH",
        resolutionTimeHours: 3.5,
      });
      expect(ticket.subject).toBe("Custom Subject");
      expect(ticket.companyId).toBe("hs-company-42");
      expect(ticket.priority).toBe("HIGH");
      expect(ticket.resolutionTimeHours).toBe(3.5);
    });

    it("generates unique ticketIds per call", () => {
      const a = buildHubSpotTicket();
      const b = buildHubSpotTicket();
      expect(a.ticketId).not.toBe(b.ticketId);
    });

    it("allows companyId to be explicitly set to null", () => {
      const ticket = buildHubSpotTicket({ companyId: null });
      expect(ticket.companyId).toBeNull();
    });
  });
});
