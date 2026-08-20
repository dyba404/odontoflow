import { execSync } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";
import { expect, test, request, type Page } from "@playwright/test";
import {
  BASE,
  altaClinicaPorUI,
  esperarCorreo,
  extraerUrl,
  verificarEntorno,
} from "./vivo/helpers";

// Suite v1.9.0: fundador, panel de plataforma multi-página (resumen/tenants/
// usuarios/auditoría), acciones de soporte con motivo obligatorio y
// suspensión bulk. Corre serial (npm run test:e2e:admin) contra un fundador
// E2E cuya contraseña temporal re-establece el beforeAll por cada proyecto.

const REPO_ROOT = resolve(process.cwd(), "../..");

const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL ?? "fundador-e2e@odontoflow.local";
const FOUNDER_PASS_TEMPORAL = process.env.FOUNDER_PASSWORD ?? "E2EFundador2026!";
const FOUNDER_PASS_NUEVA = "E2ENuevaClave2026!";
const NOMBRE_DEMO = "Clínica Dental Sonrisa";

test.describe.configure({ mode: "serial" });

async function esperarPuerto(port: number, timeoutMs: number) {
  const fin = Date.now() + timeoutMs;
  while (Date.now() < fin) {
    try {
      await new Promise<void>((resolveOk, reject) => {
        const socket = net.connect({ port, host: "127.0.0.1" });
        socket.setTimeout(3000, () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
        socket.once("connect", () => {
          socket.destroy();
          resolveOk();
        });
        socket.once("error", (e) => {
          socket.destroy();
          reject(e);
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`puerto ${port} no respondió en ${timeoutMs}ms`);
}

test.beforeAll(async () => {
  await esperarPuerto(5432, 120_000);
  let ultimoError: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      execSync("npm run db:seed:founder", {
        cwd: REPO_ROOT,
        env: { ...process.env, FOUNDER_EMAIL, FOUNDER_PASSWORD: FOUNDER_PASS_TEMPORAL },
        shell: true,
        stdio: "pipe",
        windowsHide: true,
        timeout: 120_000,
      });
      return;
    } catch (e) {
      ultimoError = e;
      await esperarPuerto(5432, 60_000);
    }
  }
  throw ultimoError;
});

const clinica = { nombre: "", email: "", slug: "" };
let tenantIdClinica = "";
let claveOwnerActualizada = "";
let urlImpersonacionUsada = "";

async function loginPorUI(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}

/** Login del fundador por API con reintento ante rate limit (bucket 10/min). */
async function loginFundadorApi(password: string): Promise<string> {
  const ctx = await request.newContext();
  try {
    for (let intento = 0; intento < 4; intento++) {
      const res = await ctx.post(`${BASE}/api/auth/login`, {
        data: { email: FOUNDER_EMAIL, password },
      });
      if (res.status() === 429) {
        const retryAfter = Math.min(Number(res.headers()["retry-after"] ?? "15"), 65);
        await new Promise((r) => setTimeout(r, retryAfter * 1000 + 500));
        continue;
      }
      if (!res.ok()) {
        throw new Error(`login fundador falló (${FOUNDER_EMAIL}): ${res.status()} ${await res.text()}`);
      }
      const setCookie = (await res.headersArray())
        .filter((h) => h.name.toLowerCase() === "set-cookie")
        .map((h) => h.value)
        .find((c) => c.startsWith("of_session="));
      if (!setCookie) throw new Error("login fundador sin cookie of_session");
      return setCookie.split(";")[0]!.slice("of_session=".length);
    }
    throw new Error("login fundador agotó reintentos por rate limit");
  } finally {
    await ctx.dispose();
  }
}

async function sesionFundador(page: Page, password: string) {
  const token = await loginFundadorApi(password);
  await page.context().addCookies([{ name: "of_session", value: token, domain: "localhost", path: "/" }]);
}

/** Login por UI esperando una URL de llegada; reintenta una vez ante 429. */
async function loginUIHasta(page: Page, email: string, password: string, urlEsperada: RegExp) {
  for (let intento = 0; intento < 3; intento++) {
    await loginPorUI(page, email, password);
    try {
      await expect(page).toHaveURL(urlEsperada, { timeout: 15_000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 61_000));
    }
  }
  throw new Error(`login UI no llegó a ${urlEsperada} (${email})`);
}

/** Login por UI esperando un mensaje de error (bloqueado/sin acceso); reintenta ante 429. */
async function loginUIError(page: Page, email: string, password: string, errorEsperado: RegExp) {
  for (let intento = 0; intento < 3; intento++) {
    await loginPorUI(page, email, password);
    try {
      await expect(page.getByText(errorEsperado)).toBeVisible({ timeout: 12_000 });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 61_000));
    }
  }
  throw new Error(`no se vio ${errorEsperado} en login de ${email}`);
}

/** En móvil el banner de instalación PWA (coarse pointer) tapa filas: lo descartamos. */
async function descartarBannerPWA(page: Page) {
  const cerrar = page.getByRole("button", { name: "Cerrar" }).first();
  if (await cerrar.isVisible().catch(() => false)) {
    await cerrar.click();
  }
}

/** Abre la ficha del tenant desde /admin/tenants y devuelve la lista de miembros. */
async function abrirDetalle(page: Page, nombreClinica: string) {
  await page.goto(`/admin/tenants?q=${encodeURIComponent(nombreClinica)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: "Tenants" })).toBeVisible();
  await descartarBannerPWA(page);
  await page
    .locator("tbody tr", { hasText: nombreClinica })
    .first()
    .getByRole("link")
    .first()
    .click();
  await expect(page.getByRole("heading", { name: nombreClinica })).toBeVisible();
  const miembros = page.getByTestId("lista-miembros").locator("li");
  await expect(miembros.first()).toBeVisible({ timeout: 10_000 });
  return miembros;
}

function filaMiembro(lista: ReturnType<Page["locator"]>, email: string) {
  return lista.filter({ hasText: email }).first();
}

test("1. login del fundador con password temporal obliga al primer cambio", async ({ page }) => {
  await verificarEntorno();

  await loginUIHasta(page, FOUNDER_EMAIL, FOUNDER_PASS_TEMPORAL, /\/primer-acceso/);

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/primer-acceso/, { timeout: 15_000 });

  await page.locator("#pa-actual").fill(FOUNDER_PASS_TEMPORAL);
  await page.locator("#pa-nueva").fill(FOUNDER_PASS_NUEVA);
  await page.locator("#pa-confirmar").fill(FOUNDER_PASS_NUEVA);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();

  await expect(page).toHaveURL(/\/admin\/resumen/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Administración de la plataforma" })).toBeVisible();
});

test("2. /admin redirige a resumen; tenants y detalle muestran miembros", async ({ page }) => {
  await sesionFundador(page, FOUNDER_PASS_NUEVA);

  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/resumen/);
  await expect(page.getByRole("heading", { name: "Administración de la plataforma" })).toBeVisible();

  await page.goto(`/admin/tenants?q=${encodeURIComponent(NOMBRE_DEMO)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText(NOMBRE_DEMO).first()).toBeVisible();

  const miembros = await abrirDetalle(page, NOMBRE_DEMO);
  for (const email of [
    "owner@demo.odontoflow.pe",
    "recepcion@demo.odontoflow.pe",
    "luis@demo.odontoflow.pe",
    "maria@demo.odontoflow.pe",
    "asistente@demo.odontoflow.pe",
  ]) {
    await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  }
  await expect(miembros).toHaveCount(5);
});

test("3. reenvío de recuperación → correo en Mailpit → reset funcional y token de un uso", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  const { mailpit } = await verificarEntorno();
  test.skip(!mailpit, "Mailpit no disponible");

  await sesionFundador(page, FOUNDER_PASS_NUEVA);

  const ctxAlta = await browser.newContext();
  const pageAlta = await ctxAlta.newPage();
  const clinic = await altaClinicaPorUI(pageAlta, `ad${Date.now().toString(36)}`);
  await ctxAlta.close();
  clinica.nombre = clinic.nombreClinica;
  clinica.email = clinic.email;
  clinica.slug = clinic.slug;

  const lista = await abrirDetalle(page, clinica.nombre);
  const fila = filaMiembro(lista, clinica.email);
  await fila.getByRole("button", { name: "Recuperación" }).click();
  await expect(page.getByText(`Recuperación enviada a ${clinica.email}`)).toBeVisible({
    timeout: 15_000,
  });

  const correo = await esperarCorreo(clinica.email, /Restablece tu contraseña/i, 30_000);
  const token = extraerUrl(correo.html || correo.text, /\/recuperar\/([a-f0-9]+)/);

  const ctxLimpio = await browser.newContext();
  const p2 = await ctxLimpio.newPage();
  await p2.goto(`/recuperar/${token}`, { waitUntil: "domcontentloaded" });
  claveOwnerActualizada = "OwnerReset2026!";
  await p2.locator("#reset-password").fill(claveOwnerActualizada);
  await p2.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(p2).toHaveURL(/\/login$/, { timeout: 15_000 });

  await loginUIHasta(p2, clinica.email, claveOwnerActualizada, /\/consola/);
  await ctxLimpio.close();

  const resReuso = await page.request.post(`${BASE}/api/auth/recuperar/${token}`, {
    data: { password: "OtraClave2026!" },
  });
  expect(resReuso.status()).toBe(400);
});

test("4. impersonación con banner permanente, botón Salir y sesión del objetivo", async ({ page }) => {
  test.skip(!clinica.email, "clínica E2E no registrada (depende del test 3)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);
  const lista = await abrirDetalle(page, clinica.nombre);
  const fila = filaMiembro(lista, clinica.email);

  let urlImp = "";
  page.on("request", (req) => {
    const m = req.url().match(/\/api\/admin\/impersonar\/([a-f0-9]+)/);
    if (m) urlImp = req.url();
  });
  await fila.getByRole("button", { name: "Impersonar" }).click();

  await expect(page).toHaveURL(/\/consola/, { timeout: 20_000 });
  expect(urlImp).toMatch(/\/api\/admin\/impersonar\/[a-f0-9]+$/);
  urlImpersonacionUsada = urlImp;

  const banner = page.getByText(/Operando como .* · .* — vía .*/);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(clinica.nombre);
  await expect(banner).toContainText(FOUNDER_EMAIL);

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/admin\/resumen/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Administración de la plataforma" })).toBeVisible();
});

test("5. cuenta bloqueada no puede loguearse hasta desbloquearla (bloquear exige motivo)", async ({
  browser,
  page,
}) => {
  test.skip(!clinica.email, "clínica E2E no registrada (depende del test 3)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);
  const lista = await abrirDetalle(page, clinica.nombre);
  const fila = filaMiembro(lista, clinica.email);

  await fila.getByRole("button", { name: "Bloquear" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await dialogo.locator("#motivo-miembro").fill("Prueba de soporte E2E");
  await dialogo.getByRole("button", { name: "Bloquear" }).click();
  await expect(fila.getByText("Bloqueado", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const ctxVictima = await browser.newContext();
  const pv = await ctxVictima.newPage();
  await loginUIError(pv, clinica.email, claveOwnerActualizada, /Cuenta bloqueada/);
  await expect(pv).toHaveURL(/\/login/);
  await ctxVictima.close();

  await fila.getByRole("button", { name: "Desbloquear" }).click();
  await expect(fila.getByText("Bloqueado", { exact: true })).toHaveCount(0, { timeout: 10_000 });
});

test("6. membresía desactivada pierde acceso; token de impersonación reusado responde 410", async ({
  browser,
  page,
}) => {
  test.skip(!clinica.email, "clínica E2E no registrada (depende del test 3)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);
  const lista = await abrirDetalle(page, clinica.nombre);
  const fila = filaMiembro(lista, clinica.email);

  await fila.getByRole("button", { name: "Desactivar" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await dialogo.locator("#motivo-miembro").fill("Desactivación de prueba");
  await dialogo.getByRole("button", { name: "Desactivar" }).click();
  await expect(fila.getByText("Inactivo", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const ctxVictima = await browser.newContext();
  const pv = await ctxVictima.newPage();
  await loginUIError(pv, clinica.email, claveOwnerActualizada, /no tiene acceso/i);
  await ctxVictima.close();

  await fila.getByRole("button", { name: "Activar" }).click();
  await expect(fila.getByText("Inactivo", { exact: true })).toHaveCount(0, { timeout: 10_000 });

  expect(urlImpersonacionUsada).not.toBe("");
  const res = await page.request.get(urlImpersonacionUsada);
  expect(res.status()).toBe(410);
});

test("7. admin con membresía activa sigue entrando a /admin (sin lockout)", async ({ browser, page }) => {
  function membresiaFundador(accion: "crear" | "borrar") {
    execSync(`npx tsx packages/db/src/membresia-fundador-e2e.ts ${accion}`, {
      cwd: REPO_ROOT,
      env: { ...process.env, FOUNDER_EMAIL },
      shell: true,
      stdio: "pipe",
      windowsHide: true,
      timeout: 60_000,
    });
  }

  await sesionFundador(page, FOUNDER_PASS_NUEVA);
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Administración de la plataforma" })).toBeVisible();

  membresiaFundador("crear");
  try {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await loginUIHasta(p, FOUNDER_EMAIL, FOUNDER_PASS_NUEVA, /\/admin\/resumen/);
    await expect(
      p.getByRole("heading", { name: "Administración de la plataforma" }),
    ).toBeVisible();
    await ctx.close();
  } finally {
    membresiaFundador("borrar");
  }
});

test("8. búsqueda global de usuarios enlaza con la ficha del tenant", async ({ page }) => {
  test.skip(!clinica.email, "clínica E2E no registrada (depende del test 3)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);

  await page.goto(`/admin/usuarios?q=${encodeURIComponent(clinica.email)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByText(clinica.email).first()).toBeVisible();
  await page.getByRole("link", { name: "Ver en tenant" }).first().click();
  await expect(page.getByRole("heading", { name: clinica.nombre })).toBeVisible();
  tenantIdClinica = page.url().split("/admin/tenants/")[1] ?? "";
  expect(tenantIdClinica).toMatch(/^[a-f0-9-]+$/);
});

test("9. suspensión bulk exige motivo y aviso de owner; luego se puede reactivar", async ({
  browser,
  page,
}) => {
  test.skip(!clinica.email, "clínica E2E no registrada (depende del test 3)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);
  await abrirDetalle(page, clinica.nombre);

  await page.getByRole("button", { name: "Suspender membresías" }).click();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();

  const confirmar = dialogo.getByRole("button", { name: "Suspender todas" });
  await expect(confirmar).toBeDisabled();
  await dialogo.locator(`#motivo-bulk-${tenantIdClinica}`).fill("E2E: suspensión bulk de prueba");
  await expect(confirmar).toBeDisabled();
  await dialogo.getByRole("checkbox").check();
  await expect(confirmar).toBeEnabled();
  await confirmar.click();

  await expect(page.getByText(/Membresías .* desactivadas/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Inactivo", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const ctxVictima = await browser.newContext();
  const pv = await ctxVictima.newPage();
  await loginUIError(pv, clinica.email, claveOwnerActualizada, /no tiene acceso/i);
  await ctxVictima.close();

  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("Inactivo", { exact: true })).toHaveCount(0, { timeout: 10_000 });

  await page.goto("/admin/auditoria?accion=soporte.membresias_desactivadas_bulk", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator("tbody tr").first()).toContainText(clinica.nombre);
});

test("10. APIs de soporte exigen motivo: membresía PATCH 400, bulk 400, suscripción 400", async ({
  page,
}) => {
  test.skip(!tenantIdClinica, "tenant E2E no resuelto (depende del test 8)");
  await sesionFundador(page, FOUNDER_PASS_NUEVA);

  const resMiembros = await page.request.get(`${BASE}/api/admin/tenants/${tenantIdClinica}/members`);
  expect(resMiembros.status()).toBe(200);
  const { miembros } = (await resMiembros.json()) as {
    miembros: Array<{ membershipId: string }>;
  };
  const membershipId = miembros[0]?.membershipId;
  expect(membershipId).toBeTruthy();

  const sinNota = await page.request.patch(`${BASE}/api/admin/memberships/${membershipId}`, {
    data: { active: false },
  });
  expect(sinNota.status()).toBe(400);
  expect(await sinNota.json()).toMatchObject({ error: "motivo_requerido" });

  const bulkSinMotivo = await page.request.post(`${BASE}/api/admin/memberships/bulk`, {
    data: { tenantId: tenantIdClinica, active: false },
  });
  expect(bulkSinMotivo.status()).toBe(400);
  expect(await bulkSinMotivo.json()).toMatchObject({ error: "motivo_requerido" });

  const susSinNota = await page.request.patch(`${BASE}/api/admin/suscripcion`, {
    data: { tenantId: tenantIdClinica, estado: "suspendido" },
  });
  expect(susSinNota.status()).toBe(400);
  expect(await susSinNota.json()).toMatchObject({ error: "motivo_requerido" });
});
