import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    // Set env vars before app.ts is imported so AI_PROVIDER resolves
    // to "heuristic" and live-API keys are not read during tests.
    setupFiles: ["./src/test-setup.ts"],
  },
});
