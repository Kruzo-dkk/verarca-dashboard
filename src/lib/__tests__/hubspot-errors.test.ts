import { describe, it, expect } from "vitest";
import { isMissingScopesError } from "../hubspot-errors";

describe("isMissingScopesError", () => {
  it("detects 403 MISSING_SCOPES from /objects/emails", () => {
    const err = new Error(
      'HubSpot API error 403: {"status":"error","message":"This app hasn\'t been granted all required scopes to make this call.","category":"MISSING_SCOPES"}'
    );
    expect(isMissingScopesError(err)).toBe(true);
  });

  it("detects 403 with 'scope needed for this API call isn't available for public use' (tickets case)", () => {
    const err = new Error(
      'HubSpot API error 403: {"status":"error","message":"The scope needed for this API call isn\'t available for public use."}'
    );
    expect(isMissingScopesError(err)).toBe(true);
  });

  it("does not flag generic 403", () => {
    const err = new Error("HubSpot API error 403: forbidden");
    expect(isMissingScopesError(err)).toBe(false);
  });

  it("does not flag 500 / 401", () => {
    expect(isMissingScopesError(new Error("HubSpot API error 500: oops"))).toBe(false);
    expect(isMissingScopesError(new Error("HubSpot API error 401: token expired"))).toBe(false);
  });

  it("handles raw string input from sourceErrors metadata", () => {
    const msg = 'HubSpot API error 403: {"category":"MISSING_SCOPES"}';
    expect(isMissingScopesError(msg)).toBe(true);
  });

  it("handles non-Error / non-string input", () => {
    expect(isMissingScopesError(null)).toBe(false);
    expect(isMissingScopesError(undefined)).toBe(false);
    expect(isMissingScopesError(42)).toBe(false);
  });
});
