import { describe, it, expect } from "vitest";
import { diffToAuditEntries } from "@/lib/audit";

describe("diffToAuditEntries", () => {
  it("emits an entry only for changed fields, stringifying values", () => {
    const entries = diffToAuditEntries(
      "customer", "42", "thomas@andersens.nu",
      { scope_override: null, tier_override: "Standard", segment: "B" },
      { scope_override: "Scope 1-2-3", tier_override: "Standard" }
    );
    expect(entries).toEqual([
      { entityType: "customer", entityId: "42", field: "scope_override", oldValue: null, newValue: "Scope 1-2-3", changedBy: "thomas@andersens.nu" },
    ]);
  });
});
