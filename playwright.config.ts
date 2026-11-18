import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Ignora se o arquivo não existir ou se as variáveis já estiverem carregadas
}

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const targetPort = Number(new URL(baseUrl).port || 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90000,
  expect: {
    timeout: 20000,
  },
  reporter: "list",
  use: {
    baseURL: baseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    port: targetPort,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
