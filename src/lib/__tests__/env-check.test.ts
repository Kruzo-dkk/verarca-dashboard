import { describe, it, expect } from "vitest";
import { checkEnv } from "@/lib/env-check";

const full = {
  FRISBII_API_KEY: "x",
  NEXT_PUBLIC_SUPABASE_URL: "x",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "x",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  CRON_SECRET: "x",
  HUBSPOT_API_TOKEN: "x",
  CLICKUP_API_TOKEN: "x",
  CLICKUP_WORKSPACE_ID: "x",
  RESEND_API_KEY: "x",
};

describe("checkEnv", () => {
  it("ok when all required present", () => {
    const r = checkEnv(full);
    expect(r.ok).toBe(true);
    expect(r.requiredMissing).toEqual([]);
    expect(r.integrationsMissing).toEqual([]);
  });

  it("flags missing required vars (and treats blank as missing)", () => {
    const r = checkEnv({ ...full, CRON_SECRET: "", FRISBII_API_KEY: undefined });
    expect(r.ok).toBe(false);
    expect(r.requiredMissing.sort()).toEqual(["CRON_SECRET", "FRISBII_API_KEY"]);
  });

  it("flags missing integration vars without failing required", () => {
    const r = checkEnv({ ...full, RESEND_API_KEY: undefined });
    expect(r.ok).toBe(true);
    expect(r.integrationsMissing).toEqual(["RESEND_API_KEY"]);
  });
});
