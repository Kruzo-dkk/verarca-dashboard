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
 * Infer Danish accounting class (Regnskabsklasse) from the plan handle.
 *
 * Danish accounting classes:
 *   B (Mikro) — smallest companies (a-b-mikro plans)
 *   B         — small companies (b plans)
 *   C (Mellem) — medium companies (c-mellem plans)
 *   C (Stor)   — large companies (c-stor plans)
 *
 * Samhandel (indkøbsforening) customers are classified by their
 * underlying size, not as a separate segment.
 */
export function inferSegmentFromPlan(planHandle: string | null): string {
  if (!planHandle) return "Unknown";
  const lower = planHandle.toLowerCase();

  // Check for size qualifiers first (most specific)
  if (lower.includes("mikro")) return "B (Mikro)";
  if (lower.includes("stor")) return "C (Stor)";
  if (lower.includes("mellem")) return "C (Mellem)";

  // Strip samhandel prefix to check underlying size
  const stripped = lower.replace(/^samhandel-?/, "");

  // Single-letter size prefix before "scope"
  const sizeMatch = stripped.match(/^([a-c])-scope/);
  if (sizeMatch) {
    const letter = sizeMatch[1];
    if (letter === "a") return "B (Mikro)";
    if (letter === "b") return "B";
    if (letter === "c") return "C (Mellem)"; // bare "c" defaults to mellem
  }

  // a-b prefix (mikro range)
  if (stripped.startsWith("a-b-") || stripped.startsWith("a-b")) return "B (Mikro)";

  // Bare "scope-" without size prefix (e.g. "scope-1-2-3-standard")
  if (stripped.startsWith("scope-")) return "B";

  return "Unknown";
}

/**
 * Extract scope coverage from plan handle.
 * Returns "Scope 1-2-3", "Scope 1-2", or null for non-scope plans.
 */
export function inferScopeFromPlan(planHandle: string | null | undefined): string | null {
  if (!planHandle) return null;
  const match = planHandle.toLowerCase().match(/scope-([\d]+(?:-[\d]+)*)/);
  if (!match) return null;
  return `Scope ${match[1]}`;
}

/**
 * Extract service tier from plan handle.
 * Returns "Standard", "Managed", or null.
 */
export function inferTierFromPlan(planHandle: string | null | undefined): string | null {
  if (!planHandle) return null;
  const lower = planHandle.toLowerCase();
  if (lower.includes("managed")) return "Managed";
  if (lower.includes("standard")) return "Standard";
  // Service plans without explicit tier
  if (lower.includes("supported")) return "Managed";
  if (lower.includes("prime")) return "Managed";
  return null;
}
