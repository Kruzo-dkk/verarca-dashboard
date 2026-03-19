/**
 * Role definitions and route access matrix for Verarca RBAC.
 *
 * Three roles exist:
 *   - management: full access — can edit settings, view all data, manage users
 *   - board:      curated read-only — sees aggregate KPIs + board report
 *   - investor:   M&A-centric read-only — sees revenue quality + benchmarks
 */

export type UserRole = "management" | "board" | "investor";

export const VALID_ROLES: UserRole[] = ["management", "board", "investor"];

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

// ─── Route Access Matrix ─────────────────────────────────────────
// Maps route prefixes to the roles that can access them.
// Order matters: more specific prefixes should come first.

interface RouteRule {
  prefix: string;
  roles: UserRole[];
}

export const ROUTE_ACCESS: RouteRule[] = [
  // API routes — handled by requireRole() in each route handler
  // Cron routes bypass auth entirely (checked by CRON_SECRET)
  { prefix: "/api/cron", roles: ["management", "board", "investor"] },
  { prefix: "/api/users", roles: ["management"] },
  { prefix: "/api/settings", roles: ["management"] },
  { prefix: "/api/forecast", roles: ["management"] },
  { prefix: "/api/report/board", roles: ["management", "board"] },
  { prefix: "/api/report/investor", roles: ["management", "investor"] },
  { prefix: "/api", roles: ["management"] },

  // Dashboard pages
  { prefix: "/users", roles: ["management"] },
  { prefix: "/customers", roles: ["management"] },
  { prefix: "/forecast", roles: ["management"] },
  { prefix: "/monthly-input", roles: ["management"] },
  { prefix: "/reports", roles: ["management", "board", "investor"] },

  // Main dashboard — all roles (unified view with role-based tabs)
  { prefix: "/", roles: ["management", "board", "investor"] },
];

/**
 * Check if a role has access to a given pathname.
 */
export function canAccess(role: UserRole, pathname: string): boolean {
  // Auth routes are always accessible
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return true;
  }

  // Find the most specific matching rule
  for (const rule of ROUTE_ACCESS) {
    if (rule.prefix === "/" ? pathname === "/" : pathname.startsWith(rule.prefix)) {
      return rule.roles.includes(role);
    }
  }

  // Default: deny
  return false;
}

/**
 * Get the default landing page for a role.
 */
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case "management":
      return "/";
    case "board":
      return "/";
    case "investor":
      return "/";
  }
}
