import { expect, test } from "@playwright/test";
import { USUARIOS, loginPorApi } from "./auth";

const ES_FICHA = /\/consola\/pacientes\/[0-9a-f-]+/;
const ES_LISTADO = /\/consola\/pacientes/;
const ES_AGENDA = /\/consola\/agenda/;

function nombreDeLaTarjeta(page: import("@playwright/test").Page, indice: number) {
  return page
    .getByRole("link")
    .filter({ hasText: /visita|Sin citas/ })
    .nth(indice)
    .locator("p")
    .first()
    .innerText();
}

// Regresion del bug reportado en v1.5.0 (fixed v1.5.1): al ir a Pacientes y
// abrir la ficha de un paciente funcionaba la primera vez, pero al volver
// atras y hacer click en otra persona la navegacion SPA parecia no cargar
// (el service worker podia servir HTML cacheado con chunks viejos). Abrir en
// otra pestana si cargaba. Este spec ejerce el patron exacto sin recargas:
// listado -> click ficha -> atras -> click otra ficha -> nav entre modulos.
test("navegacion SPA: pacientes listado -> ficha -> atras -> otra ficha -> agenda", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const token = await loginPorApi(USUARIOS.owner.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  // Espera a que el listing real reemplace el skeleton (si aplica).
  await expect(page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first()).toBeVisible();
  const total = await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).count();
  expect(total).toBeGreaterThanOrEqual(2);

  const nombreTarjeta1 = await nombreDeLaTarjeta(page, 0);
  const nombreTarjeta2 = await nombreDeLaTarjeta(page, 1);

  // 1er click SPA: abre una ficha.
  await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first().click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();
  await expect(page.locator("h2").first()).toContainText(nombreTarjeta1.trim());

  // Atras al listado sin recarga.
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(ES_LISTADO);
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  // 2do click SPA en otra ficha: aqui vivia el bug.
  await page
    .getByRole("link")
    .filter({ hasText: /visita|Sin citas/ })
    .nth(1)
    .click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();
  await expect(page.locator("h2").first()).toContainText(nombreTarjeta2.trim());

  // Ida y vuelta repetida: no debe quedar atrapada en HTML viejo.
  await page.goBack();
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: /visita|Sin citas/ }).first().click();
  await expect(page).toHaveURL(ES_FICHA);
  await expect(page.getByText("Historial de citas")).toBeVisible();

  // Navegacion SPA entre modulos desde la barra lateral.
  const sidebar = page.locator("aside");
  await sidebar.getByRole("link", { name: /Agenda/, exact: false }).first().click();
  await expect(page).toHaveURL(ES_AGENDA);
  await expect(page.getByRole("heading", { level: 2, name: /Agenda/ })).toBeVisible();
  await sidebar.getByRole("link", { name: "Pacientes", exact: false }).first().click();
  await expect(page).toHaveURL(ES_LISTADO);
  await expect(page.getByRole("heading", { level: 2, name: "Pacientes" })).toBeVisible();

  await context.close();
});

// El service worker no debe cachear HTML de navegaciones (era la causa raiz):
// la version instalada debe ser la que solo guarda offline.html en caché.
test("el service worker no guarda HTML de paginas en cache", async ({ browser, baseURL }) => {
  // 1) El SW registrado es la version fix (sw.js con CACHE_NAME v2 y sin cache.put en navigate).
  const swSrc = await (await fetch(`${baseURL}/sw.js`)).text();
  expect(swSrc).toContain("of-cache-v2");
  expect(swSrc).not.toMatch(/mode === "navigate"[\s\S]{0,200}cache\.put/);

  // 2) En un cliente real, tras visitar y recargar con el SW activo,
  // el cache no debe contener HTML de rutas de pagina.
  const context = await browser.newContext();
  const token = await loginPorApi(USUARIOS.owner.email);
  await context.addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
  const page = await context.newPage();

  await page.goto("/consola/pacientes", { waitUntil: "domcontentloaded" });
  // Esperar a que el SW quede activo controlando la pagina.
  await page.waitForFunction(
    () => "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  ).catch(async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => "serviceWorker" in navigator && navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 20_000 },
    );
  });

  const htmlEnCache = await page.evaluate(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) {
        const url = new URL(req.url);
        const esHtmlDePagina =
          !url.pathname.startsWith("/_next/") &&
          !url.pathname.startsWith("/icons/") &&
          url.pathname !== "/offline.html" &&
          url.pathname !== "/" &&
          !/\.[a-z0-9]{2,}$/i.test(url.pathname);
        if (esHtmlDePagina) return true;
      }
    }
    return false;
  });
  expect(htmlEnCache).toBe(false);

  await context.close();
});
