/**
 * Heuristics for internal / test customers that must be excluded from all
 * metrics. Conservative: matches on the Frisbii handle ("test"), internal
 * Verarca email domains, and obviously-fake CVR numbers — not on display name
 * (too many false positives).
 */
const FAKE_CVRS = new Set([
  "12345678",
  "00000000",
  "11111111",
  "12121212",
  "22222222",
  "99999999",
  "87654321",
]);

export function isTestCustomer(c: {
  frisbii_handle: string;
  email: string | null;
  cvr: string | null;
}): boolean {
  if (/test/i.test(c.frisbii_handle)) return true;

  const email = (c.email ?? "").toLowerCase().trim();
  if (/@verarca\.(com|ai|dk)$/.test(email)) return true;

  const cvr = (c.cvr ?? "").replace(/\D/g, "");
  if (cvr && FAKE_CVRS.has(cvr)) return true;

  return false;
}
