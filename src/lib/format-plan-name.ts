/**
 * Parse Frisbii plan handles into human-readable display names.
 *
 * Handle patterns:
 *   b-scope-1-2-3-standard          → B · Scope 1-2-3
 *   c-mellem-scope-1-2-3-standard   → C Mellem · Scope 1-2-3
 *   a-b-mikro-scope-1-2-3-standard  → A-B Mikro · Scope 1-2-3
 *   samhandel-b-scope-1-2-standard  → Samhandel · B · Scope 1-2
 *   prime-lcd                        → Prime LCD
 *   verarca-software-managed-carbon-service → Managed Carbon Service
 *   supported-carbon-service         → Supported Carbon Service
 *   Samhandel2026                    → Samhandel 2026
 */

const SPECIAL_PLANS: Record<string, string> = {
  "prime-lcd": "Prime LCD",
  "verarca-software-managed-carbon-service": "Managed Carbon Service",
  "supported-carbon-service": "Supported Carbon Service",
};

// Words that should stay uppercase or have specific casing
const CASE_MAP: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  lcd: "LCD",
  mikro: "Mikro",
  mellem: "Mellem",
  stor: "Stor",
  samhandel: "Samhandel",
  scope: "Scope",
  standard: "Standard",
  managed: "Managed",
};

export function formatPlanName(handle: string | null | undefined): string | null {
  if (!handle) return null;

  // Check special plans first
  const lower = handle.toLowerCase();
  if (SPECIAL_PLANS[lower]) return SPECIAL_PLANS[lower];

  // Handle "Samhandel2026" style (no hyphens, camelCase-ish)
  const yearMatch = handle.match(/^([A-Za-z]+)(\d{4})$/);
  if (yearMatch) {
    return `${capitalize(yearMatch[1])} ${yearMatch[2]}`;
  }

  // Parse structured handles: [prefix?]-[size]-scope-X-Y[-Z]-[tier]
  const scopeMatch = lower.match(
    /^(.*?)?scope-([\d]+(?:-[\d]+)*)-(standard|managed)$/
  );

  if (scopeMatch) {
    const prefix = scopeMatch[1]?.replace(/-$/, "") ?? "";
    const scopes = scopeMatch[2]; // e.g. "1-2-3"
    const tier = scopeMatch[3];

    const parts: string[] = [];

    // Parse prefix into segments (e.g. "samhandel-c-mellem" → ["Samhandel", "C Mellem"])
    if (prefix) {
      parts.push(...formatPrefix(prefix));
    }

    parts.push(`Scope ${scopes}`);

    // Only show tier if not "standard" (it's the default)
    if (tier !== "standard") {
      parts.push(CASE_MAP[tier] ?? capitalize(tier));
    }

    return parts.join(" · ");
  }

  // Fallback: capitalize and replace hyphens
  return handle
    .split("-")
    .map((w) => CASE_MAP[w.toLowerCase()] ?? capitalize(w))
    .join(" ");
}

function formatPrefix(prefix: string): string[] {
  const tokens = prefix.split("-");
  const result: string[] = [];
  let current: string[] = [];

  // Known deal types that stand alone
  const DEAL_TYPES = new Set(["samhandel", "sindico"]);
  // Known size qualifiers that attach to the preceding size letter
  const SIZE_QUALIFIERS = new Set(["mikro", "mellem", "stor"]);

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (DEAL_TYPES.has(lower)) {
      if (current.length > 0) {
        result.push(current.map((t) => CASE_MAP[t] ?? capitalize(t)).join("-"));
        current = [];
      }
      result.push(CASE_MAP[lower] ?? capitalize(lower));
    } else if (SIZE_QUALIFIERS.has(lower)) {
      // Attach to previous token(s) as a size qualifier: "a-b mikro" → "A-B Mikro"
      const sizeLetters = current.map((t) => CASE_MAP[t.toLowerCase()] ?? capitalize(t)).join("-");
      const qualifier = CASE_MAP[lower] ?? capitalize(lower);
      result.push(sizeLetters ? `${sizeLetters} ${qualifier}` : qualifier);
      current = [];
    } else if (lower.length <= 2 && /^[a-z]$/.test(lower)) {
      // Single letter = size indicator
      current.push(token);
    } else {
      if (current.length > 0) {
        result.push(current.map((t) => CASE_MAP[t.toLowerCase()] ?? capitalize(t)).join("-"));
        current = [];
      }
      current.push(token);
    }
  }

  if (current.length > 0) {
    result.push(current.map((t) => CASE_MAP[t.toLowerCase()] ?? capitalize(t)).join("-"));
  }

  return result;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Infer a meaningful segment from the plan handle based on size indicators.
 */
export function inferSegmentFromPlan(planHandle: string | null): string {
  if (!planHandle) return "Unknown";
  const lower = planHandle.toLowerCase();

  if (lower.includes("mikro")) return "Mikro";
  if (lower.includes("stor")) return "Stor";
  if (lower.includes("mellem")) return "Mellem";
  if (lower.includes("samhandel")) return "Samhandel";
  if (lower.includes("managed") || lower.includes("prime")) return "Managed";

  // Single-letter size prefix before "scope"
  const sizeMatch = lower.match(/^([a-c])-scope/);
  if (sizeMatch) {
    const letter = sizeMatch[1].toUpperCase();
    if (letter === "A") return "Mikro";
    if (letter === "B") return "Standard";
    if (letter === "C") return "Mellem";
  }

  // a-b prefix
  if (lower.startsWith("a-b-")) return "Mikro";

  return "Standard";
}
