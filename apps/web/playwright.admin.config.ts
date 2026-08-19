import { defineConfig, devices } from "@playwright/test";

// Suite de soporte de plataforma (v1.7.0): fundador, acciones admin e
// impersonación auditada. Corre SERIAL (workers 1) porque comparte el estado
// del fundador E2E; el spec re-establece su contraseña temporal en beforeAll
// (db:seed:founder) por cada proyecto. Requiere servidor :3111, Mailpit :8025
// y WSL/Docker arriba.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["admin.spec.ts"],
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: null,
  use: {
    baseURL: "http://localhost:3111",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Acciones admin y banner de impersonación en móvil.
      name: "admin-movil",
      use: { ...devices["Pixel 7"] },
    },
  ],
});