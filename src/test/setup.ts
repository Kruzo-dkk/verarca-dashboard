import { afterEach, vi } from "vitest";

// Restore all mocks after each test to prevent leakage between files
afterEach(() => {
  vi.restoreAllMocks();
});
