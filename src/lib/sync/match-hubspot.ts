import type { CompanyIndex } from "@/lib/hubspot-companies";

// ─── Types ──────────────────────────────────────────────────────

export interface HubSpotMatchResult {
  hubspotCompanyId: string;
  matchMethod: "cvr" | "domain" | "name";
}

// ─── Helpers ────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*(aps|a\/s|ivs|k\/s|as|is|holding|group)\s*$/i, "")
    .replace(/[^a-z0-9æøå ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── 3-tier matching engine ─────────────────────────────────────

export function matchCustomerToHubSpot(
  customer: {
    cvr: string | null;
    email: string | null;
    name: string;
  },
  index: CompanyIndex
): HubSpotMatchResult | null {
  // 1. CVR match
  if (customer.cvr) {
    const digits = customer.cvr.replace(/\D/g, "");
    if (digits.length >= 6) {
      const match = index.byCVR.get(digits);
      if (match) {
        return { hubspotCompanyId: match.id, matchMethod: "cvr" };
      }
    }
  }

  // 2. Domain match (from email)
  if (customer.email) {
    const domain = customer.email.split("@")[1]?.toLowerCase();
    if (domain) {
      const match = index.byDomain.get(domain);
      if (match) {
        return { hubspotCompanyId: match.id, matchMethod: "domain" };
      }
    }
  }

  // 3. Name match
  const normalized = normalizeName(customer.name);
  if (normalized) {
    const match = index.byName.get(normalized);
    if (match) {
      return { hubspotCompanyId: match.id, matchMethod: "name" };
    }
  }

  return null;
}
