import { describe, it, expect } from "vitest";
import {
  isValidRole,
  canAccess,
  getDefaultRoute,
  VALID_ROLES,
  ROUTE_ACCESS,
  type UserRole,
} from "../auth/roles";

// ─── isValidRole ─────────────────────────────────────────────────

describe("isValidRole", () => {
  it("returns true for valid roles", () => {
    expect(isValidRole("management")).toBe(true);
    expect(isValidRole("board")).toBe(true);
    expect(isValidRole("investor")).toBe(true);
  });

  it("returns false for invalid roles", () => {
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole("MANAGEMENT")).toBe(false);
  });
});

// ─── canAccess ───────────────────────────────────────────────────

describe("canAccess", () => {
  describe("management role", () => {
    it("can access everything", () => {
      expect(canAccess("management", "/")).toBe(true);
      expect(canAccess("management", "/customers")).toBe(true);
      expect(canAccess("management", "/monthly-input")).toBe(true);
      expect(canAccess("management", "/forecast")).toBe(true);
      expect(canAccess("management", "/reports")).toBe(true);
      expect(canAccess("management", "/users")).toBe(true);
    });
  });

  describe("board role", () => {
    it("can access reports", () => {
      expect(canAccess("board", "/reports")).toBe(true);
    });

    it("cannot access management-only pages", () => {
      expect(canAccess("board", "/")).toBe(false);
      expect(canAccess("board", "/customers")).toBe(false);
      expect(canAccess("board", "/monthly-input")).toBe(false);
      expect(canAccess("board", "/forecast")).toBe(false);
      expect(canAccess("board", "/users")).toBe(false);
    });
  });

  describe("investor role", () => {
    it("can access reports", () => {
      expect(canAccess("investor", "/reports")).toBe(true);
    });

    it("cannot access management-only pages", () => {
      expect(canAccess("investor", "/")).toBe(false);
      expect(canAccess("investor", "/customers")).toBe(false);
      expect(canAccess("investor", "/monthly-input")).toBe(false);
    });
  });

  describe("auth routes", () => {
    it("all roles can access login", () => {
      for (const role of VALID_ROLES) {
        expect(canAccess(role, "/login")).toBe(true);
      }
    });

    it("all roles can access auth callback", () => {
      for (const role of VALID_ROLES) {
        expect(canAccess(role, "/auth/callback")).toBe(true);
      }
    });
  });

  describe("API routes", () => {
    it("management can access all API routes", () => {
      expect(canAccess("management", "/api/users")).toBe(true);
      expect(canAccess("management", "/api/settings")).toBe(true);
      expect(canAccess("management", "/api/report/board")).toBe(true);
      expect(canAccess("management", "/api/report/investor")).toBe(true);
    });

    it("board can access board report API", () => {
      expect(canAccess("board", "/api/report/board")).toBe(true);
    });

    it("board cannot access other APIs", () => {
      expect(canAccess("board", "/api/users")).toBe(false);
      expect(canAccess("board", "/api/settings")).toBe(false);
    });

    it("investor can access investor API", () => {
      expect(canAccess("investor", "/api/report/investor")).toBe(true);
    });

    it("investor cannot access other APIs", () => {
      expect(canAccess("investor", "/api/users")).toBe(false);
      expect(canAccess("investor", "/api/settings")).toBe(false);
      expect(canAccess("investor", "/api/report/board")).toBe(false);
    });
  });

  it("denies access to unknown routes by default", () => {
    expect(canAccess("board", "/unknown-route")).toBe(false);
  });
});

// ─── getDefaultRoute ─────────────────────────────────────────────

describe("getDefaultRoute", () => {
  it("returns / for management", () => {
    expect(getDefaultRoute("management")).toBe("/");
  });

  it("returns /reports for board", () => {
    expect(getDefaultRoute("board")).toBe("/reports");
  });

  it("returns /reports for investor", () => {
    expect(getDefaultRoute("investor")).toBe("/reports");
  });
});

// ─── ROUTE_ACCESS integrity ──────────────────────────────────────

describe("ROUTE_ACCESS", () => {
  it("every rule has at least one role", () => {
    for (const rule of ROUTE_ACCESS) {
      expect(rule.roles.length).toBeGreaterThan(0);
    }
  });

  it("all roles in rules are valid", () => {
    for (const rule of ROUTE_ACCESS) {
      for (const role of rule.roles) {
        expect(VALID_ROLES).toContain(role);
      }
    }
  });

  it("management has access to all routes", () => {
    for (const rule of ROUTE_ACCESS) {
      expect(rule.roles).toContain("management");
    }
  });
});
