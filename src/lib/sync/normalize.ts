// ─── Name normalisation helpers ────────────────────────────────
// Shared by sync-customers (ClickUp/HubSpot matching) and detect-customer-links
// (email/name duplicate suggestions). Keep the two in sync via this module.

export const COMPANY_SUFFIXES = /\s*(aps|a\/s|ivs|k\/s|as|is|holding|group)\s*$/i;

/**
 * Normalises a company/person name for fuzzy equality:
 * lowercase, trim, strip a trailing company suffix, drop punctuation,
 * collapse whitespace. Returns "" for empty/whitespace input.
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(COMPANY_SUFFIXES, "")
    .replace(/[^a-z0-9æøå ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits-only CVR, or null when there is no usable number. */
export function normalizeCvr(cvr: string | null | undefined): string | null {
  if (!cvr) return null;
  const digits = cvr.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** Lowercased, trimmed email, or null when empty. */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.length > 0 ? e : null;
}
