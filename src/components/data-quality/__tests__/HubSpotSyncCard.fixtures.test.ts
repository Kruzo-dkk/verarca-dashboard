import { describe, it, expect } from "vitest";
import { allSuccess, mixed, allFailed, noData } from "./HubSpotSyncCard.fixtures";

describe("HubSpotSyncCard fixtures — structural integrity", () => {
  // ─── allSuccess ─────────────────────────────────────────────────

  describe("allSuccess", () => {
    it("has 4 sync health entries", () => {
      expect(allSuccess.syncHealth).toHaveLength(4);
    });

    it("covers all four modules", () => {
      const modules = allSuccess.syncHealth.map((h) => h.module);
      expect(modules).toContain("pipeline");
      expect(modules).toContain("activities");
      expect(modules).toContain("tickets");
      expect(modules).toContain("customers");
    });

    it("all modules have success status", () => {
      for (const h of allSuccess.syncHealth) {
        expect(h.status).toBe("success");
      }
    });

    it("apiStatus is ok", () => {
      expect(allSuccess.apiStatus.ok).toBe(true);
      expect(allSuccess.apiStatus.error).toBeNull();
    });

    it("matchRate is present with valid rate in 0..1", () => {
      expect(allSuccess.matchRate).not.toBeNull();
      expect(allSuccess.matchRate!.rate).toBeGreaterThanOrEqual(0);
      expect(allSuccess.matchRate!.rate).toBeLessThanOrEqual(1);
    });

    it("matchRate.matched <= matchRate.total", () => {
      expect(allSuccess.matchRate!.matched).toBeLessThanOrEqual(allSuccess.matchRate!.total);
    });
  });

  // ─── mixed ──────────────────────────────────────────────────────

  describe("mixed", () => {
    it("has 4 sync health entries", () => {
      expect(mixed.syncHealth).toHaveLength(4);
    });

    it("contains a failed module", () => {
      const statuses = mixed.syncHealth.map((h) => h.status);
      expect(statuses).toContain("failed");
    });

    it("contains a running module", () => {
      const statuses = mixed.syncHealth.map((h) => h.status);
      expect(statuses).toContain("running");
    });

    it("failed module has an errorMessage", () => {
      const failed = mixed.syncHealth.find((h) => h.status === "failed");
      expect(failed).toBeDefined();
      expect(typeof failed!.errorMessage).toBe("string");
      expect(failed!.errorMessage!.length).toBeGreaterThan(0);
    });

    it("apiStatus is ok", () => {
      expect(mixed.apiStatus.ok).toBe(true);
    });
  });

  // ─── allFailed ──────────────────────────────────────────────────

  describe("allFailed", () => {
    it("has 4 sync health entries", () => {
      expect(allFailed.syncHealth).toHaveLength(4);
    });

    it("apiStatus is not ok and has error message", () => {
      expect(allFailed.apiStatus.ok).toBe(false);
      expect(typeof allFailed.apiStatus.error).toBe("string");
      expect(allFailed.apiStatus.error!.length).toBeGreaterThan(0);
    });

    it("matchRate is null", () => {
      expect(allFailed.matchRate).toBeNull();
    });

    it("has at least one failed module", () => {
      const statuses = allFailed.syncHealth.map((h) => h.status);
      expect(statuses).toContain("failed");
    });
  });

  // ─── noData ─────────────────────────────────────────────────────

  describe("noData", () => {
    it("has 0 sync health entries", () => {
      expect(noData.syncHealth).toHaveLength(0);
    });

    it("matchRate is null", () => {
      expect(noData.matchRate).toBeNull();
    });

    it("apiStatus is ok (API up, but no syncs have run)", () => {
      expect(noData.apiStatus.ok).toBe(true);
    });
  });

  // ─── Cross-fixture type invariants ───────────────────────────────

  describe("type invariants across all fixtures", () => {
    const fixtures = [allSuccess, mixed, allFailed, noData];

    it("every syncHealth entry has required fields", () => {
      for (const fixture of fixtures) {
        for (const h of fixture.syncHealth) {
          expect(typeof h.module).toBe("string");
          expect(typeof h.status).toBe("string");
          expect(typeof h.startedAt).toBe("string");
          // durationMs, recordsFetched, recordsUpserted may be null
          expect(h.durationMs === null || typeof h.durationMs === "number").toBe(true);
          expect(h.recordsFetched === null || typeof h.recordsFetched === "number").toBe(true);
          expect(h.recordsUpserted === null || typeof h.recordsUpserted === "number").toBe(true);
        }
      }
    });

    it("apiStatus always has ok (boolean) and error (string|null)", () => {
      for (const fixture of fixtures) {
        expect(typeof fixture.apiStatus.ok).toBe("boolean");
        expect(fixture.apiStatus.error === null || typeof fixture.apiStatus.error === "string").toBe(true);
      }
    });
  });
});
