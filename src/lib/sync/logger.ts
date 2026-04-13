/**
 * Thin logging wrapper for sync modules.
 *
 * Why this exists: pre-commit hooks flag bare console.log as debug
 * leftovers, but sync/cron modules need operational logging that
 * feeds into Vercel's log stream. This wrapper preserves that
 * behavior while passing lint checks.
 */

/* eslint-disable no-console */
export const syncLog = {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
