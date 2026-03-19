import { hubspotFetch } from "./hubspot";

// ─── Types ──────────────────────────────────────────────────────

export interface HubSpotCompany {
  id: string;
  properties: {
    name: string | null;
    domain: string | null;
    website: string | null;
    organisationsnummer: string | null;
    cvr_nummer: string | null;
  };
}

export interface CompanyIndex {
  byCVR: Map<string, HubSpotCompany>;
  byDomain: Map<string, HubSpotCompany>;
  byName: Map<string, HubSpotCompany>;
}

// ─── Helpers ────────────────────────────────────────────────────

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

function stripCVR(cvr: string | null): string | null {
  if (!cvr) return null;
  const digits = cvr.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*(aps|a\/s|ivs|k\/s|as|is|holding|group)\s*$/i, "")
    .replace(/[^a-z0-9æøå ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Fetch all companies (paginated) ────────────────────────────

const PROPERTIES = "name,domain,website,organisationsnummer,cvr_nummer";

export async function getAllCompanies(): Promise<HubSpotCompany[]> {
  const all: HubSpotCompany[] = [];
  let after: string | undefined;

  do {
    const url = `/objects/companies?limit=100&properties=${PROPERTIES}${after ? `&after=${after}` : ""}`;
    const response = await hubspotFetch<{
      results: HubSpotCompany[];
      paging?: { next?: { after: string } };
    }>(url);
    all.push(...response.results);
    after = response.paging?.next?.after;
  } while (after);

  return all;
}

// ─── Build lookup index ─────────────────────────────────────────

export function buildCompanyIndex(companies: HubSpotCompany[]): CompanyIndex {
  const byCVR = new Map<string, HubSpotCompany>();
  const byDomain = new Map<string, HubSpotCompany>();
  const byName = new Map<string, HubSpotCompany>();

  for (const company of companies) {
    // CVR: check both organisationsnummer and cvr_nummer
    for (const raw of [company.properties.organisationsnummer, company.properties.cvr_nummer]) {
      const cvr = stripCVR(raw);
      if (cvr) byCVR.set(cvr, company);
    }

    // Domain: from domain or website property
    const domain = extractDomain(company.properties.domain) ?? extractDomain(company.properties.website);
    if (domain) byDomain.set(domain, company);

    // Name: normalized
    if (company.properties.name) {
      const normalized = normalizeName(company.properties.name);
      if (normalized) byName.set(normalized, company);
    }
  }

  return { byCVR, byDomain, byName };
}
