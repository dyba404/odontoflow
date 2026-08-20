import { expect, test, type BrowserContext } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

const BASE = "http://localhost:3111";
const CLINICA_DEMO = "dental";
const NOMBRE_CLINICA_DEMO = "Clínica Dental Sonrisa";
const FICHA_DEMO = "75f57945-8ad7-4649-b0dd-34aab7b0fdfd";
const TOKEN_INVALIDO = "0".repeat(48);

// v1.8.0: botón "Portal del paciente" en la ficha → POST /api/pacientes/[id]/portal
// genera (o reutiliza) el token portal de 30 días y devuelve la URL pública
// /<clinica>/portal/<token>. Aquí se cubre: 401 sin sesión, generación con
// sesión de staff (token estable), carga del portal con el link y token inválido.
test("portal del paciente: staff genera el link y el portal carga sin sesión", async ({
  browser,
}) => {
  const token = await loginPorApi(USUARIOS.owner.email);
  const ctx: BrowserContext = await browser.newContext();
  await ctx.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);

  // Sin sesión: 401
  const anon = await browser.newContext();
  const sinSesion = await anon.request.post(`${BASE}/api/pacientes/${FICHA_DEMO}/portal`);
  expect(sinSesion.status()).toBe(401);
  await anon.close();

  // Con sesión de staff: genera la URL del portal
  const res = await ctx.request.post(`${BASE}/api/pacientes/${FICHA_DEMO}/portal`);
  expect(res.status()).toBe(200);
  const { url } = (await res.json()) as { url: string };
  expect(url).toMatch(new RegExp(`^${BASE}/${CLINICA_DEMO}/portal/[a-f0-9]{48}$`));

  // Y es estable: reusar devuelve el mismo token (no se emite uno nuevo por click)
  const res2 = await ctx.request.post(`${BASE}/api/pacientes/${FICHA_DEMO}/portal`);
  expect(res2.status()).toBe(200);
  const { url: url2 } = (await res2.json()) as { url: string };
  expect(url2).toBe(url);

  // El link abre el portal sin sesión: clínica y saludo al paciente
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(NOMBRE_CLINICA_DEMO).first()).toBeVisible();
  await expect(page.getByText(/Hola,/).first()).toBeVisible();

  // Token inválido: la API responde 404 y la página lo muestra
  const invalido = await ctx.request.get(`${BASE}/api/portal/${TOKEN_INVALIDO}`);
  expect(invalido.status()).toBe(404);
  await page.goto(`${BASE}/${CLINICA_DEMO}/portal/${TOKEN_INVALIDO}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText("Enlace no válido")).toBeVisible();

  await ctx.close();
});
