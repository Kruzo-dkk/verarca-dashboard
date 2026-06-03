/**
 * Required environment variables, grouped by criticality. checkEnv reports which
 * are missing (presence only — never the values) so a /api/health route or a
 * startup log can surface misconfiguration before a route/cron fails at runtime.
 */
export const REQUIRED_ENV = [
  "FRISBII_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
] as const;

export const INTEGRATION_ENV = [
  "HUBSPOT_API_TOKEN",
  "CLICKUP_API_TOKEN",
  "CLICKUP_WORKSPACE_ID",
  "RESEND_API_KEY",
] as const;

export interface EnvCheck {
  ok: boolean;
  requiredMissing: string[];
  integrationsMissing: string[];
}

export function checkEnv(env: Record<string, string | undefined> = process.env): EnvCheck {
  const missing = (keys: readonly string[]) =>
    keys.filter((k) => !env[k] || env[k]!.trim() === "");
  const requiredMissing = missing(REQUIRED_ENV);
  return {
    ok: requiredMissing.length === 0,
    requiredMissing,
    integrationsMissing: missing(INTEGRATION_ENV),
  };
}
