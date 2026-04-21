import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default pool for unit tests (fast, no Workers runtime needed)
    // E2E tests use vitest.config.e2e.ts which enables the cloudflare pool
    include: ["tests/unit/**/*.test.ts"],
  },
});