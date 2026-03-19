/**
 * Inline SVG icons for navigation — no external dependency.
 * All icons are 20×20 with stroke-based design for consistency.
 */

interface IconProps {
  className?: string;
}

/** Dashboard / chart icon */
export function DashboardIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="7" height="8" rx="1" />
      <rect x="11" y="2" width="7" height="5" rx="1" />
      <rect x="2" y="12" width="7" height="6" rx="1" />
      <rect x="11" y="9" width="7" height="9" rx="1" />
    </svg>
  );
}

/** People / customers icon */
export function CustomersIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7" cy="6" r="3" />
      <path d="M2 17c0-3 2.5-5 5-5s5 2 5 5" />
      <circle cx="14" cy="7" r="2" />
      <path d="M14 11c2 0 4 1.5 4 4" />
    </svg>
  );
}

/** Trend line / forecast icon */
export function ForecastIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2,14 6,10 10,12 14,5 18,3" />
      <polyline points="14,3 18,3 18,7" />
      <line x1="2" y1="18" x2="18" y2="18" />
    </svg>
  );
}

/** Gear / settings icon */
export function SettingsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="3" />
      <path d="M10 1.5v2M10 16.5v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1.5 10h2M16.5 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4" />
    </svg>
  );
}

/** Document / board report icon */
export function BoardReportIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="2" width="14" height="16" rx="2" />
      <line x1="7" y1="6" x2="13" y2="6" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="14" x2="11" y2="14" />
    </svg>
  );
}

/** Chart bar / investor icon */
export function InvestorIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="12" width="3" height="6" rx="0.5" />
      <rect x="7" y="8" width="3" height="10" rx="0.5" />
      <rect x="12" y="4" width="3" height="14" rx="0.5" />
      <line x1="17" y1="2" x2="17" y2="18" />
      <polyline points="15,4 17,2 19,4" />
    </svg>
  );
}

/** User group / team management icon */
export function UsersIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="5" r="3" />
      <path d="M4 18c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <line x1="16" y1="7" x2="16" y2="13" />
      <line x1="13" y1="10" x2="19" y2="10" />
    </svg>
  );
}

/** Target / bullseye sales icon */
export function SalesIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="10" r="8" />
      <circle cx="10" cy="10" r="5" />
      <circle cx="10" cy="10" r="2" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="10" y1="16" x2="10" y2="18" />
      <line x1="2" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="18" y2="10" />
    </svg>
  );
}

/** Refresh icon */
export function RefreshIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 8a6.5 6.5 0 0 1 11.5-4" />
      <polyline points="13,1 13,4 10,4" />
      <path d="M14.5 8a6.5 6.5 0 0 1-11.5 4" />
      <polyline points="3,15 3,12 6,12" />
    </svg>
  );
}

/** Clipboard with bar chart / combined reports icon */
export function ReportsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 2h6v2H7z" />
      <rect x="4" y="3" width="12" height="15" rx="2" />
      <line x1="7" y1="14" x2="7" y2="10" />
      <line x1="10" y1="14" x2="10" y2="8" />
      <line x1="13" y1="14" x2="13" y2="11" />
    </svg>
  );
}

/** Three horizontal dots (more menu) icon */
export function MoreIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Calendar with pencil / monthly input icon */
export function MonthlyInputIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="16" height="14" rx="2" />
      <line x1="6" y1="2" x2="6" y2="6" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="2" y1="8" x2="18" y2="8" />
      <path d="M12 12l3-3 1.5 1.5-3 3H12v-1.5z" />
    </svg>
  );
}

/** Door with arrow / sign-out icon */
export function SignOutIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="2" width="9" height="16" rx="2" />
      <path d="M12 10H18" />
      <polyline points="15,7 18,10 15,13" />
    </svg>
  );
}

/** Left chevron (16×16) */
export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="10,3 5,8 10,13" />
    </svg>
  );
}

/** Right chevron (16×16) */
export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6,3 11,8 6,13" />
    </svg>
  );
}
