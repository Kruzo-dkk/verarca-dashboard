import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the headless-Chromium packages out of the bundler — @sparticuz/chromium
  // ships a binary that must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
