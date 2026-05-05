/**
 * Detect whether a HubSpot API error indicates a missing-scope condition
 * that the operator cannot resolve from the application side.
 *
 * Two known production cases (May 2026):
 *   1. /objects/emails — 403 with category=MISSING_SCOPES, requires
 *      sales-email-read / crm.objects.emails.read.
 *   2. /objects/tickets — 403 with "The scope needed for this API call
 *      isn't available for public use", requires private-app scope.
 */
export function isMissingScopesError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message
    : typeof err === "string" ? err
    : null;
  if (!msg) return false;
  if (!msg.includes("403")) return false;
  return (
    msg.includes("MISSING_SCOPES") ||
    msg.includes("scope needed for this API call isn't available for public use")
  );
}
