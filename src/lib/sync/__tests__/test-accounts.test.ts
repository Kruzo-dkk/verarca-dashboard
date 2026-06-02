import { describe, it, expect } from "vitest";
import { isTestCustomer } from "@/lib/sync/test-accounts";

describe("isTestCustomer", () => {
  it("flags a 'test' handle (any casing)", () => {
    expect(isTestCustomer({ frisbii_handle: "KASPER-TEST", email: null, cvr: null })).toBe(true);
    expect(isTestCustomer({ frisbii_handle: "Test-01", email: "x@real.dk", cvr: "43235060" })).toBe(true);
  });

  it("flags internal verarca emails", () => {
    expect(isTestCustomer({ frisbii_handle: "cust-1", email: "kasper@verarca.com", cvr: null })).toBe(true);
    expect(isTestCustomer({ frisbii_handle: "cust-1", email: "x@verarca.ai", cvr: null })).toBe(true);
  });

  it("flags obviously fake CVRs", () => {
    expect(isTestCustomer({ frisbii_handle: "cust-1", email: "x@real.dk", cvr: "12345678" })).toBe(true);
  });

  it("does NOT flag a normal customer", () => {
    expect(
      isTestCustomer({ frisbii_handle: "cust-0011", email: "kaes@cgjensen.dk", cvr: "40120742" })
    ).toBe(false);
  });
});
