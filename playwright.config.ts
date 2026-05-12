import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.E2E_WEB_PORT ?? 4173);
const apiPort = Number(process.env.E2E_API_PORT ?? 3100);
const webUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const apiUrl = process.env.E2E_API_URL ?? `http://127.0.0.1:${apiPort}/api/v1`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `pnpm --filter @stackfast/api dev`,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(apiPort),
        NODE_ENV: "development",
        ALLOW_AUTH_BYPASS: "true",
        CORS_ORIGIN: webUrl,
      },
    },
    {
      command: `pnpm --filter @stackfast/web build && pnpm --dir apps/web exec vite preview --host 127.0.0.1 --port ${webPort}`,
      url: webUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_URL: apiUrl,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
