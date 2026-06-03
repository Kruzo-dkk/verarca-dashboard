"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Returns true when viewport is below the Tailwind `sm` breakpoint (640px). */
export function useIsMobile(): boolean {
  // Server snapshot is `false` — desktop-first, matching the previous default.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
