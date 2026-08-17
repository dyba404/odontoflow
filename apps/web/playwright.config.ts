import { defineConfig, devices } from "@playwright/test";

// El servidor NO se levanta desde Playwright: ejecutar antes
// powershell -NoProfile -ExecutionPolicy Bypass -File scripts/serve-console.ps1
// (next start en http://localhost:3111).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: null,
  use: {
    baseURL: "http://localhost:3111",
    headless: true,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
