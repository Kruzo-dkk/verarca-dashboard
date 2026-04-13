import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/supabase/database.types.ts",
        "src/lib/types/**",
        "src/**/*.test.ts",
      ],
      thresholds: {
        statements: 20,
        branches: 17,
        functions: 18,
        lines: 19,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
