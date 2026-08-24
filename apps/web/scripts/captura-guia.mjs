// Regenera las capturas de la guía (apps/web/public/guia/*.png) contra la app
// desplegada, con la sesión real del owner del seed piloto.
//
// Uso (desde apps/web o la raíz del repo):
//   node scripts/captura-guia.mjs
//   E2E_BASE=https://app.marsmode.me node scripts/captura-guia.mjs
//
// Requisitos: app desplegada con el seed piloto (duena@vitalia.pe) y un token
// de portal vigente de la paciente demo (los IDs de abajo se leyeron de la BD
// de producción; actualízalos si re-seedeas).
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const BASE = process.env.E2E_BASE || "https://app.marsmode.me";
const EMAIL = process.env.E2E_EMAIL || "duena@vitalia.pe";
const PASSWORD = process.env.E2E_PASSWORD || "Vitalia2026!";
const FICHA =
  process.env.E2E_FICHA_ID || "ff9958b7-018d-4460-8831-e7b5fb3f1252"; // Rosa (seed)
const TOKEN_PORTAL =
  process.env.E2E_PORTAL_TOKEN ||
  "7b75a064b84fdda10ee886fa3fdcf430c2e726c12c72984d"; // portal vigente de Rosa
const SLUG = process.env.E2E_SLUG || "vitalia";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "guia",
);
mkdirSync(OUT, { recursive: true });

const PUBLICAS = {
  portal: `/${SLUG}/portal/${TOKEN_PORTAL}`,
  reserva: `/${SLUG}/reserva`,
};

const CONSOLA = {
  agenda: "/consola/agenda",
  solicitudes: "/consola/solicitudes",
  "sala-espera": "/consola/sala-espera",
  ficha: `/consola/pacientes/${FICHA}`,
  caja: "/consola/caja",
  comprobantes: "/consola/caja/comprobantes",
  cuotas: "/consola/cuotas",
  recall: "/consola/recall",
  "config-legal": "/consola/config/legal",
  "config-fiscal": "/consola/config/fiscal",
  "config-servicios": "/consola/config/servicios",
};

const browser = await chromium.launch();

// ---- Públicas (sin sesión) ----
const ctxPub = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const pub = await ctxPub.newPage();
for (const [nombre, ruta] of Object.entries(PUBLICAS)) {
  await pub.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await pub.waitForLoadState("networkidle").catch(() => {});
  await pub.waitForTimeout(600);
  await pub.screenshot({ path: join(OUT, `${nombre}.png`) });
  console.log(`OK ${nombre}`);
}
await ctxPub.close();

// ---- Consola (login real por UI con el owner del seed) ----
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
await page.fill("#login-email", EMAIL);
await page.fill("#login-password", PASSWORD);
await page.getByRole("button", { name: /Iniciar sesión/ }).click();
await page.waitForURL(/\/consola/, { timeout: 30000 });
console.log("login OK");

for (const [nombre, ruta] of Object.entries(CONSOLA)) {
  await page.goto(BASE + ruta, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${nombre}.png`) });
  console.log(`OK ${nombre}`);
}
await ctx.close();
await browser.close();
console.log(`Capturas de guía listas en ${OUT}`);
