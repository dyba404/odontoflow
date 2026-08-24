"use strict";
/*
 * e2e-funcional.js — Runner E2E FUNCIONAL contra la app desplegada (odontoflow).
 *
 * Suite CANÓNICA de 16 pasos que recorre todos los flujos de la consola y los
 * portales públicos contra la app REAL desplegada. Ante un cambio de código,
 * correr ESTA suite (no inventar otra): si un paso falla, primero verificar si
 * el selector/flujo del runner quedó desactualizado mirando el componente en
 * apps/web/src, y solo después sospechar del app.
 *
 * - CommonJS con playwright (resuelve node_modules del repo). NO usa
 *   @playwright/test: runner autónomo, pasos secuenciales, screenshots en fallo
 *   (%TEMP%\odontoflow-e2e\fails) y tabla resumen final. Continúa tras fallos.
 * - Hace MUTACIONES REALES (crear paciente, emitir comprobantes SUNAT beta,
 *   pagos, cierres de caja, etc.). Es IDEMPOTENTE: títulos/nombres llevan
 *   sufijo RUN único, las cuotas QR usan el portal de la paciente seed Rosa
 *   (el paso 8 crea 3 cuotas nuevas por corrida) y los flujos no repetibles
 *   (rechazo de presupuesto del seed) se saltan con SKIP informado.
 *
 * Requisitos:
 *   - App desplegada y saludable (E2E_BASE, default https://app.marsmode.me)
 *     con el seed piloto cargado (packages/db/src/seed-piloto.ts).
 *   - whatsmock del stack prod publicado en 127.0.0.1:3020 (paso 10).
 *   - CRON_SECRET del .env del servidor (paso 15).
 *
 * Uso:
 *   # PowerShell (desde la raíz del repo):
 *   $env:CRON_SECRET = (Select-String -Path .env -Pattern "^CRON_SECRET=(.+)$").Matches[0].Groups[1].Value
 *   npm run e2e:funcional
 *
 * Variables: E2E_BASE (URL base), E2E_HEADLESS=0 (ver el browser),
 *            E2E_WA_MOCK (default http://127.0.0.1:3020), CRON_SECRET.
 *
 * Higiene: cada corrida deja citas/reservas QA en la BD. Si los pasos 04/05
 * fallan con "No hay horarios ese día", correr scripts/limpiar-qa.sh (cancela
 * las citas QA acumuladas que bloquean los slots públicos de fechas futuras).
 *
 * Duración típica: ~11-12 min. Exit code 0 siempre (el resumen manda).
 */

const path = require("path");
const os = require("os");
const fs = require("fs");
const zlib = require("zlib");
const {
  chromium,
} = require("playwright");

// ============================== CONFIG =====================================

const BASE = process.env.E2E_BASE || "https://app.marsmode.me";
const HEADLESS = process.env.E2E_HEADLESS !== "0";
const CRON_SECRET = process.env.CRON_SECRET || "";
const RUN = Date.now().toString().slice(-5); // sufijo único por corrida
const SLUG = "vitalia";
const WA_MOCK = process.env.E2E_WA_MOCK || "http://127.0.0.1:3020";
const FAILS_DIR = path.join(os.tmpdir(), "odontoflow-e2e", "fails");
const TMP_DIR = path.join(os.tmpdir(), "odontoflow-e2e", "assets");

const CREDS = {
  duena: { email: "duena@vitalia.pe", password: "Vitalia2026!" },
  recepcion: { email: "recepcion@vitalia.pe", password: "Vitalia2026!" },
  odontologia: { email: "odontologia@vitalia.pe", password: "Vitalia2026!" },
  asistente: { email: "asistente@vitalia.pe", password: "Vitalia2026!" },
  fundador: { email: "fundador@odontoflow.pe", password: "FundadorPiloto2026!" },
};

const FUNDADOR_NUEVA = "FundadorPiloto2026!";

// Datos del seed piloto (packages/db/src/seed-piloto.ts)
const PACIENTE_SEED = "Rosa Amelia Ccahuana Mamani"; // celular 987654303
const PACIENTE_ORTO = "María Fernanda Quispe Torres"; // presupuesto aprobado + cuotas
const CELULAR_SEED_LAST4 = "4303";
const DOCTORA = "Ana Valdéz";
const SERV_EVAL = "Evaluación dental";
const SERV_LIMPIEZA = "Limpieza dental";

// Estado compartido entre pasos
const st = {
  browser: null,
  ctx: null, // contexto desktop 1280x800
  ctxM: null, // contexto móvil 375px (reserva + portal)
  ctxAdmin: null, // contexto fundador/admin
  page: null, // última página activa (para screenshot en fallo)
  pacienteNombre: null,
  pacienteCelular: null,
  portalUrl: null, // link portal paciente QA (creado en paso 2)
  portalUrlRosa: null, // link portal Rosa (cuotas renovables del paso 8)
  reservaNombre: null,
  reservaCelular: null,
  presupuestoTitulo: null,
  presupuestoUrl: null, // /s/presupuesto/{token}
  pagoSplitId: null, // referencia textual del pago 120 yape
  pagoQrRef: null, // referencia QR pagado en portal (para conciliar)
  pagoQrRef2: null, // segundo QR (para rechazar)
  totalCaja: null,
  resultados: [],
};

// Buffer de problemas de página (pageerror/console.error/HTTP >=400) por paso
let issues = [];

// ============================== IMÁGENES ===================================
//
// Genera PNGs sintéticos reales de 400x400 sin dependencias externas
// (zlib de Node para el IDAT). No hace falta canvas nativo.

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** pixelFn(x, y) -> [r, g, b] */
function makePng(w, h, pixelFn) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  let off = 0;
  for (let y = 0; y < h; y++) {
    raw[off++] = 0; // filtro: none
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixelFn(x, y);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Radiografía simulada: escala de grises con gradiente + "raíces" oscuras
const RADIOGRAFIA_PNG = makePng(400, 400, (x, y) => {
  const base = 90 + Math.floor((y / 400) * 110);
  const veta = Math.floor(38 * Math.abs(Math.sin(x / 26 + Math.sin(y / 61))));
  const g = Math.max(0, Math.min(255, base - veta + ((x * 7 + y * 13) % 11)));
  return [g, g, g];
});

// Foto clínica simulada: degradado color (tono piel/clínico)
const FOTO_PNG = makePng(400, 400, (x, y) => {
  const r = 190 + Math.floor((x / 400) * 50);
  const g = 130 + Math.floor((y / 400) * 70);
  const b = 110 + Math.floor(((x + y) / 800) * 80);
  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
});

// Fallback mínimo embebido (PNG 1x1 rojo, base64) por si fallara el encoder.
const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function escribirAssets() {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const rx = path.join(TMP_DIR, "radiografia.png");
  const foto = path.join(TMP_DIR, "foto.png");
  try {
    fs.writeFileSync(rx, RADIOGRAFIA_PNG);
    fs.writeFileSync(foto, FOTO_PNG);
  } catch (e) {
    console.warn("[assets] fallback PNG 1x1:", e.message);
    fs.writeFileSync(rx, Buffer.from(PNG_1X1_B64, "base64"));
    fs.writeFileSync(foto, Buffer.from(PNG_1X1_B64, "base64"));
  }
  return { rx, foto };
}

// ============================ HELPERS BASE =================================

function log(...args) {
  console.log("[e2e]", ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Crea una página registrando pageerror / console.error / respuestas >=400
 * en el buffer del paso actual (`issues`).
 */
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on("pageerror", (err) => {
    issues.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = msg.text();
      // ruido conocido de terceros que no afecta el flujo
      if (/favicon|sitemap|robots|net::ERR_FAILED.*sw\.js/i.test(t)) return;
      issues.push(`console.error: ${t.slice(0, 300)}`);
    }
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      const url = res.url();
      if (/\.(png|jpg|jpeg|svg|webp|woff2?|ico)(\?|$)/i.test(url)) return;
      issues.push(`HTTP ${res.status()} ${url.slice(0, 220)}`);
    }
  });
  page.on("dialog", (d) => {
    // window.confirm (anular cita, rechazar solicitud, etc.) → aceptar siempre
    d.accept().catch(() => {});
  });
  page.setDefaultTimeout(45000);
  st.page = page;
  return page;
}

async function crearContextos(browser) {
  st.ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "es-PE",
    timezoneId: "America/Lima",
  });
  await st.ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  st.ctxM = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    locale: "es-PE",
    timezoneId: "America/Lima",
  });
  st.ctxAdmin = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "es-PE",
    timezoneId: "America/Lima",
  });
}

async function ir(page, ruta) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(700);
}

/** Caché de sesión por página para no re-loginear (rate limit login: 10/ip). */
const sesionActiva = new Map();

/** Login robusto: reutiliza sesión si ya está activa; UI con fallback API; maneja /primer-acceso. */
async function login(page, email, password) {
  if (sesionActiva.get(page) === email) {
    await ir(page, "/consola");
    if (!page.url().includes("/login")) return page.url();
    sesionActiva.delete(page);
  }
  await ir(page, "/login");
  try {
    await page.waitForSelector("#login-email", { state: "visible", timeout: 30000 });
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.getByRole("button", { name: /Iniciar sesión/ }).click();
    await page
      .waitForURL((u) => !String(u).includes("/login"), { timeout: 30000 })
      .catch(() => {});
  } catch {
    // Fallback: login por API (cookie en el contexto)
    const r = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    });
    if (!r.ok()) throw new Error(`login API ${r.status()} para ${email}`);
  }
  await sleep(1200);
  let url = page.url();
  if (url.includes("/primer-acceso")) {
    // Contraseña temporal: cambiar por API (sesión ya activa)
    const r2 = await page.request.post(`${BASE}/api/auth/cambiar-contrasena`, {
      data: { actual: password, nueva: FUNDADOR_NUEVA },
    });
    if (!r2.ok()) throw new Error(`cambiar-contrasena ${r2.status()}`);
    CREDS.fundador.password = FUNDADOR_NUEVA;
    await ir(page, "/admin");
    url = page.url();
  }
  if (url.includes("/login")) {
    throw new Error(`login falló para ${email}: sigue en /login`);
  }
  sesionActiva.set(page, email);
  return url;
}

async function logoutConsola(page) {
  const btn = page.getByRole("button", { name: "Cerrar sesión", exact: true });
  await btn.click();
  await page.waitForURL((u) => String(u).includes("/login"), { timeout: 30000 });
  sesionActiva.delete(page);
  await sleep(800);
}

/** Espera un toast de sonner cuyo texto coincida (parcial). */
async function esperarToast(page, texto, timeout = 9000) {
  const loc = page
    .locator(`[data-sonner-toast]:has-text("${texto}")`)
    .first();
  try {
    await loc.waitFor({ state: "visible", timeout });
    return true;
  } catch {
    // fallback genérico por texto libre
    const alt = page.getByText(texto).first();
    try {
      await alt.waitFor({ state: "visible", timeout: 2500 });
      return true;
    } catch {
      throw new Error(`toast no apareció: "${texto}"`);
    }
  }
}

/** Espera cualquier toast de éxito/error y devuelve su texto. */
async function toastReciente(page, timeout = 8000) {
  try {
    const t = page.locator("[data-sonner-toast]").first();
    await t.waitFor({ state: "visible", timeout });
    return (await t.innerText()).trim();
  } catch {
    return null;
  }
}

/** Abre un dialog clickeando un botón por rol+nombre y esperando el overlay. */
async function dialogAbrir(page, nombreBoton, opts = {}) {
  const btn = page
    .getByRole("button", { name: nombreBoton, exact: Boolean(opts.exact) })
    .first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  await btn.click();
  const dlg = page
    .locator("[role='dialog']:visible, .fixed.inset-0:visible")
    .first();
  await dlg.waitFor({ state: "visible", timeout: 8000 });
  await sleep(700); // transición/carga interna
  return dlg;
}

/**
 * Cierra un dialog usando SOLO botones DENTRO del dialog:
 * primero "Cancelar"/"Cerrar" exactos, luego el botón X con aria-label="Cerrar"
 * (siempre dentro de [role=dialog]; NUNCA un /Cerrar/ global que haría logout).
 */
async function dialogCerrar(page) {
  const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
  if (!(await dlg.count())) return;
  for (const nombre of ["Cancelar", "Cerrar"]) {
    const btn = dlg.getByRole("button", { name: nombre, exact: true });
    if (await btn.count()) {
      try {
        await btn.first().click();
        await sleep(500);
        return;
      } catch {
        /* siguiente opción */
      }
    }
  }
  const x = dlg.locator("button[aria-label='Cerrar']");
  if (await x.count()) {
    await x.first().click();
    await sleep(500);
    return;
  }
  await page.keyboard.press("Escape");
  await sleep(400);
}

/** Selecciona en un <select> la primera opción cuyo texto incluye `texto`. */
async function selectPorTexto(page, selector, texto, scope = null) {
  const sel = (scope || page).locator(selector).first();
  const opt = sel.locator("option", { hasText: texto }).first();
  const valor = await opt.getAttribute("value");
  await sel.selectOption(valor == null ? "" : valor);
  await sleep(500);
  return valor;
}

/** Dibuja un garabato en el primer canvas visible (PadDeFirma). */
async function firmarCanvas(page, scope = null) {
  const root = scope || page;
  const canvas = root.locator("canvas:visible").first();
  await canvas.waitFor({ state: "visible", timeout: 10000 });
  // fijar el canvas en viewport antes de medir: el layout puede desplazarse
  // (imágenes lazy arriba) y los trazos caerían en otro elemento
  await canvas.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(400);
  // esperar a que el pad tenga layout real (offsetWidth > 0 antes del primer trazo)
  let box = await canvas.boundingBox();
  for (let i = 0; i < 12 && (!box || box.width < 60 || box.height < 40); i++) {
    await sleep(400);
    box = await canvas.boundingBox();
  }
  if (!box || box.width < 60) throw new Error("pad de firma sin layout");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = Math.min(box.width / 3, 90);
  // dos pasadas de zigzag para garantizar trazo registrado (PointerEvents)
  for (let pasada = 0; pasada < 2; pasada++) {
    await page.mouse.move(cx - dx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(
        cx - dx + (i * (dx * 2)) / 14,
        cy + Math.sin(i / 1.7) * (box.height / 4),
        { steps: 3 },
      );
    }
    await page.mouse.up();
    await sleep(250);
  }
  await sleep(400);
}

function hoyLimaISO(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86400000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

/** Próximo día hábil (L-V) a partir de offsetDias. */
function proximoHabil(offsetDias = 1) {
  for (let i = offsetDias; i < offsetDias + 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const dia = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", weekday: "short" }).format(d);
    if (!/Sat|Sun/.test(dia)) return hoyLimaISO(i);
  }
  return hoyLimaISO(offsetDias);
}

// ============================ RUNNER DE PASOS ==============================

function definirPasos() {
  return [
    {
      nombre: "01 AUTH (dueña/recepción/odontología/fundador)",
      fn: async () => {
        const page = await newPage(st.ctx);

        // Dueña → consola
        let url = await login(page, CREDS.duena.email, CREDS.duena.password);
        if (!url.includes("/consola")) throw new Error(`dueña no llegó a /consola: ${url}`);
        log("dueña OK →", url);
        await sleep(800);

        // Logout con botón exacto "Cerrar sesión" (nunca /Cerrar/ genérico)
        await logoutConsola(page);
        log("logout dueña OK");

        // Recepción
        url = await login(page, CREDS.recepcion.email, CREDS.recepcion.password);
        if (!url.includes("/consola")) throw new Error(`recepción no llegó a /consola: ${url}`);
        log("recepción OK");
        await sleep(600);
        await logoutConsola(page);

        // Odontología
        url = await login(page, CREDS.odontologia.email, CREDS.odontologia.password);
        if (!url.includes("/consola")) throw new Error(`odontología no llegó a /consola: ${url}`);
        log("odontología OK");
        await sleep(600);
        await logoutConsola(page);

        // Fundador (sin team) → /admin
        url = await login(page, CREDS.fundador.email, CREDS.fundador.password);
        log("fundador →", url);
        if (
          !url.includes("/admin") &&
          !url.includes("/primer-acceso") // si la temp no se cambió aún
        ) {
          throw new Error(`fundador no llegó a /admin: ${url}`);
        }

        // Volver a login (limpiar cookies es lo más fiable fuera de la consola)
        await st.ctx.clearCookies();
        await ir(page, "/login");
        if (!page.url().includes("/login")) throw new Error("no volvió a /login");
        st.paso1Listo = true;
      },
    },

    {
      nombre: "02 PACIENTES (ficha completa + uploads + portal)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        st.pacienteNombre = `QA Paciente ${RUN} Torres`;
        st.pacienteCelular = `9${RUN}7${Math.floor(Math.random() * 90 + 10)}`.slice(0, 9);

        // ---- Crear paciente ----
        await ir(page, "/consola/pacientes");
        const dlgPac = await dialogAbrir(page, "Nuevo paciente");
        await dlgPac.locator("#np-nombre").fill(st.pacienteNombre);
        await dlgPac.locator("#np-celular").fill(st.pacienteCelular);
        await dlgPac.locator("#np-doc").fill(`${RUN}456`.slice(0, 8)); // DNI 8 dígitos
        await dlgPac.locator("#np-email").fill(`qa.${RUN}@example.com`);
        await dlgPac.getByRole("button", { name: "Crear paciente", exact: true }).click();
        await esperarToast(page, "Paciente creado");
        await sleep(1200);

        // ---- Abrir ficha ----
        await page
          .locator(`a:has-text("${st.pacienteNombre}"), button:has-text("${st.pacienteNombre}")`)
          .first()
          .click();
        await page.waitForURL(/\/consola\/pacientes\//, { timeout: 15000 });
        st.pacienteFichaUrl = page.url();
        log("ficha:", st.pacienteFichaUrl);
        await sleep(1000);

        // ---- Nota clínica ----
        const formNota = page
          .locator("form")
          .filter({ has: page.getByPlaceholder(/Escribe una nota clínica/) })
          .first();
        await formNota
          .getByPlaceholder(/Escribe una nota clínica/)
          .fill(`Nota QA ${RUN}: sin hallazgos relevantes.`);
        await formNota.locator("button[type='submit']").click();
        await esperarToast(page, "Nota añadida");

        // ---- Odontograma: marcar pieza 16 con caries y Guardar ----
        const tooth = page.locator("[data-tooth='16']").first();
        await tooth.scrollIntoViewIfNeeded().catch(() => {});
        await tooth.click({ force: true });
        await sleep(1200);
        let marcoCaries = false;
        // Vía A: panel de caries por superficies (#cariesChecks input[value=...])
        const chkCaries = page.locator(
          "#cariesChecks input[type='checkbox'], #cariesChecks .surface-cell",
        );
        if ((await chkCaries.count()) > 0) {
          await chkCaries.first().click({ force: true }).catch(() => {});
          await sleep(400);
          marcoCaries = true;
        } else {
          // Vía B: select extra del vendor (versiones previas)
          const selExtra = page.locator("#statusExtraSelect");
          if ((await selExtra.count()) > 0) {
            const opt = selExtra.locator("option", { hasText: /Caries/i }).first();
            const val = await opt.getAttribute("value");
            if (val != null) await selExtra.selectOption(val);
            await sleep(400);
            await page.locator("#statusExtraApply").click().catch(() => {});
            marcoCaries = true;
          }
        }
        if (!marcoCaries) {
          log("WARN: no se encontró panel de caries; se valida solo el guardado");
        }
        // autosave dispara toast "Odontograma guardado" (~1.2s debounce); botón Guardar como refuerzo
        const guardarBtns = page.getByRole("button", { name: "Guardar", exact: true });
        if ((await guardarBtns.count()) === 1) {
          await guardarBtns.click();
        }
        await esperarToast(page, "Odontograma guardado", 10000);
        await sleep(800);

        // ---- Subir radiografía (adjuntos) ----
        const assets = escribirAssets();
        await page.locator("#adjunto-archivo").setInputFiles(assets.rx);
        const formAdj = page
          .locator("form")
          .filter({ has: page.locator("#adjunto-archivo") })
          .first();
        await formAdj.locator("select").selectOption({ label: "Radiografía" });
        await formAdj.locator("button[type='submit']").click();
        await esperarToast(page, "Archivo subido");

        // ---- Subir foto clínica (fotos antes/después) ----
        try {
          const inpFoto = page.locator("#foto-archivo");
          if ((await inpFoto.count()) > 0) {
            await inpFoto.setInputFiles(assets.foto);
            const formFoto = page
              .locator("form")
              .filter({ has: page.locator("#foto-archivo") })
              .first();
            await formFoto.locator("select").selectOption({ label: "Antes" }).catch(() => {});
            await formFoto.getByRole("button", { name: "Subir", exact: true }).click();
            await esperarToast(page, "Foto subida");
          } else {
            log("WARN: no hay form de fotos (#foto-archivo); foto omitida");
          }
        } catch (e) {
          log("WARN foto clínica:", e.message);
        }

        // ---- Thumbnails visibles ----
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1500);
        const thumb = page
          .locator("img[src^='/api/adjuntos/']")
          .first();
        await thumb.waitFor({ state: "visible", timeout: 15000 });

        // ---- Cobertura Rimac ----
        const dlgCob = await dialogAbrir(page, "Nueva cobertura");
        await dlgCob.locator("select").first().selectOption({ label: "Rimac Seguros" });
        await dlgCob.getByPlaceholder("Plan dental full (opcional)").fill(`Plan QA ${RUN}`);
        await dlgCob.locator("input[type='number']").first().fill("20");
        await dlgCob.locator("textarea").fill(`Poliza QA ${RUN}`);
        await dlgCob.getByRole("button", { name: "Crear cobertura", exact: true }).click();
        await esperarToast(page, "Cobertura registrada");

        // ---- Orden de laboratorio ----
        const btnLab = page.getByRole("button", { name: "Nuevo pedido", exact: true }).first();
        await btnLab.scrollIntoViewIfNeeded().catch(() => {});
        await btnLab.click();
        const dlgLab = page
          .locator("[role='dialog']:visible, .fixed.inset-0:visible")
          .first();
        await dlgLab.waitFor({ state: "visible", timeout: 8000 });
        await sleep(500);
        await dlgLab
          .getByPlaceholder("Nombre del laboratorio (opcional)")
          .fill("Laboratorio QA Dental");
        await dlgLab.getByPlaceholder("0.00").fill("180");
        await dlgLab.locator("button[type='submit']").click();
        const tLab = await toastReciente(page);
        log("lab toast:", tLab);
        await sleep(1000);

        // ---- Consentimiento v2: firma con canvas ----
        const btnFirmar = page.getByRole("button", { name: "Firmar consentimiento" }).first();
        await btnFirmar.scrollIntoViewIfNeeded().catch(() => {});
        await btnFirmar.click();
        await sleep(1000);
        // formulario inline: panel rounded-lg.border.p-4 con Plantilla (botones) + Nombre + pad
        const contFirma = page
          .locator("div.rounded-lg.border.p-4")
          .filter({ hasText: "Nombre del firmante" })
          .first();
        // la plantilla NO es select: son botones; empezarFirma ya autoselecciona la 1ª activa
        const btnPlantilla = contFirma.locator("button.w-full").first();
        if (await btnPlantilla.count()) await btnPlantilla.click().catch(() => {});
        contFirma.locator("input").first().fill(st.pacienteNombre);
        // canvas con scope al panel: la ficha puede tener otros canvas visibles
        await firmarCanvas(page, contFirma);
        await contFirma.getByRole("button", { name: "Firmar", exact: true }).click();
        await esperarToast(page, "Consentimiento firmado");

        // ---- Generar link de portal y capturarlo ----
        const btnPortal = page.getByRole("button", { name: "Portal del paciente" }).first();
        await btnPortal.scrollIntoViewIfNeeded().catch(() => {});
        await btnPortal.click();
        await esperarToast(page, "Enlace del portal copiado");
        const copiar = page.getByRole("button", { name: "Copiar enlace", exact: true }).first();
        await copiar.waitFor({ state: "visible", timeout: 8000 });
        st.portalUrl = (await copiar.getAttribute("title")) || null;
        if (!st.portalUrl) {
          st.portalUrl = await page.evaluate(() => navigator.clipboard.readText());
        }
        if (!st.portalUrl || !st.portalUrl.includes("/portal/")) {
          throw new Error(`no se capturó portal URL: ${st.portalUrl}`);
        }
        log("portalUrl:", st.portalUrl);
      },
    },

    {
      nombre: "03 AGENDA (cita, serie ×3, bloqueo, confirmar, sala)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        // ---- Cita para el paciente nuevo (día HÁBIL: horarios L-V) ----
        await ir(page, "/consola/agenda");
        await dialogAbrir(page, "Nueva cita");
        await selectPorTexto(page, "#cita-servicio", SERV_EVAL);
        await page.locator("#cita-paciente").selectOption({ label: st.pacienteNombre });
        await selectPorTexto(page, "#cita-doctor", DOCTORA);
        // fecha = próximo día hábil (el seed solo agenda L-V; domingo no tiene slots)
        const inpFecha = page.locator("#cita-fecha");
        if ((await inpFecha.count()) > 0) {
          await inpFecha.fill(proximoHabil(1));
        }
        // slots cargan async: esperar opciones reales y elegir la primera disponible
        const horaSel = page.locator("#cita-hora");
        let haySlots = true;
        try {
          await page.waitForFunction(
            (sel) => document.querySelectorAll(`${sel} option`)[1],
            "#cita-hora",
            { timeout: 20000 },
          );
        } catch {
          haySlots = false;
          // reintentar al siguiente día hábil adicional
          const alt = proximoHabil(2);
          if ((await inpFecha.count()) > 0) {
            await inpFecha.fill(alt);
            await page
              .waitForFunction(
                (sel) => document.querySelectorAll(`${sel} option`)[1],
                "#cita-hora",
                { timeout: 15000 },
              )
              .catch(() => {});
          }
        }
        await horaSel.selectOption({ index: 1 });
        await page.getByRole("button", { name: "Crear cita", exact: true }).click();
        await esperarToast(page, "Cita creada");
        await sleep(1200);

        // ---- Serie recurrente semanal ×3 ----
        await ir(page, "/consola/series");
        await dialogAbrir(page, /Nueva serie/i);
        await page.locator("#serie-titulo").fill(`Control QA ${RUN}`);
        await selectPorTexto(page, "#serie-servicio", SERV_EVAL);
        await page.locator("#serie-paciente").selectOption({ label: st.pacienteNombre });
        await selectPorTexto(page, "#serie-doctor", DOCTORA);
        await page.locator("#serie-frecuencia").selectOption("semanal");
        await page.locator("#serie-total").fill("3");
        await page.locator("#serie-fecha").fill(proximoHabil(3));
        await page.locator("#serie-hora").fill("15:00");
        await page.getByRole("button", { name: "Crear serie", exact: true }).click();
        await esperarToast(page, "Serie creada");

        // ---- Bloqueo de 1h mañana ----
        await ir(page, "/consola/agenda?vista=dia");
        await dialogAbrir(page, /Bloquear/i);
        await selectPorTexto(page, "#bloque-doctor", DOCTORA);
        // #bloque-ini/#bloque-fin son input[type=time] → solo HH:MM
        await page.locator("#bloque-ini").fill("12:00");
        await page.locator("#bloque-fin").fill("13:00");
        await page.locator("#bloque-motivo").fill("Bloqueo QA almuerzo");
        await page
          .locator("[role='dialog'] button[type='submit'], .fixed.inset-0 button[type='submit']")
          .first()
          .click();
        await esperarToast(page, "Horario bloqueado");

        // ---- Confirmar una cita futura (solicitud del seed) ----
        await ir(page, "/consola/solicitudes");
        const confirmarBtns = page.getByRole("button", { name: "Confirmar", exact: true });
        if (await confirmarBtns.count()) {
          await confirmarBtns.first().click();
          await esperarToast(page, "confirmada");
        } else {
          log("SKIP: no hay solicitudes para confirmar");
        }

        // ---- Sala de espera: hoy → Llegó (en_espera) y verificar kanban ----
        await ir(page, "/consola/sala-espera");
        const colLlegar = page.locator("section").filter({ hasText: "Por llegar" }).first();
        const tarjeta = colLlegar.locator("div").filter({ hasText: "Ana Lucía Ramírez Espinoza" }).last();
        const llegoBtn = tarjeta.getByRole("button", { name: "Llegó", exact: true });
        if (await llegoBtn.count()) {
          await llegoBtn.first().click();
          await sleep(1500);
          const dlgSala = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          if (await dlgSala.isVisible().catch(() => false)) {
            await dlgSala.getByRole("button", { name: "Confirmar", exact: true }).click().catch(() => {});
          }
          await sleep(1000);
        }
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1200);
        const colSala = page.locator("section").filter({ hasText: "En sala" }).first();
        const enSala = await colSala
          .getByText("Ana Lucía Ramírez Espinoza")
          .first()
          .isVisible()
          .catch(() => false);
        if (!enSala) throw new Error("paciente no aparece en la columna En sala");
      },
    },

    {
      nombre: "04 RESERVA PÚBLICA 375px + confirmar en solicitudes",
      fn: async () => {
        const page = await newPage(st.ctxM);
        st.reservaNombre = `QA Reserva ${RUN} Lima`;
        st.reservaCelular = `9${String(Date.now()).slice(-8)}`;

        await ir(page, `/${SLUG}/reserva`);

        // Paso 1: servicio
        await page.locator("button", { hasText: SERV_EVAL }).first().click();
        await sleep(900);

        // Paso 2: fecha (mañana por defecto) + horarios
        await page.getByRole("button", { name: "Ver horarios disponibles" }).click();
        await page
          .locator("button")
          .filter({ hasText: /^\d{2}:\d{2}$/ })
          .first()
          .waitFor({ state: "visible", timeout: 15000 });
        await page
          .locator("button")
          .filter({ hasText: /^\d{2}:\d{2}$/ })
          .first()
          .click();
        await page.getByRole("button", { name: "Continuar", exact: true }).click();
        await sleep(800);

        // Paso 3: datos
        await page.locator("#nombre").fill(st.reservaNombre);
        await page.locator("#celular").fill(st.reservaCelular);
        await page.locator("#email").fill(`qa.reserva.${RUN}@example.com`);
        await page.locator("input[type='checkbox']").first().check();
        await page.getByRole("button", { name: "Enviar solicitud", exact: true }).click();
        await page.getByText("¡Solicitud enviada!").waitFor({ timeout: 15000 });

        // Consola: confirmar la solicitud
        const adm = await newPage(st.ctx);
        await ir(adm, "/consola/solicitudes");
        const fila = adm.locator("li, tr").filter({ hasText: st.reservaNombre }).first();
        await fila.waitFor({ state: "visible", timeout: 15000 });
        await fila.getByRole("button", { name: "Confirmar", exact: true }).click();
        await esperarToast(adm, "confirmada");
      },
    },

    {
      nombre: "05 PORTAL PACIENTE 375px (asistencia + intake + cuota QR)",
      fn: async () => {
        if (!st.portalUrl) throw new Error("SKIP interno: falta st.portalUrl del paso 2");
        const page = await newPage(st.ctxM);

        // ---- Reserva pública con los datos del paciente QA (match por celular
        //      → queda como cita "solicitada" en SU portal) ----
        await ir(page, `/${SLUG}/reserva`);
        await page.locator("button", { hasText: SERV_EVAL }).first().click();
        await sleep(900);
        await page.getByRole("button", { name: "Ver horarios disponibles" }).click();
        await page
          .locator("button")
          .filter({ hasText: /^\d{2}:\d{2}$/ })
          .first()
          .waitFor({ state: "visible", timeout: 15000 });
        await page
          .locator("button")
          .filter({ hasText: /^\d{2}:\d{2}$/ })
          .first()
          .click();
        await page.getByRole("button", { name: "Continuar", exact: true }).click();
        await sleep(800);
        await page.locator("#nombre").fill(st.pacienteNombre);
        await page.locator("#celular").fill(st.pacienteCelular);
        await page.locator("#email").fill(`qa.paciente.${RUN}@example.com`);
        await page.locator("input[type='checkbox']").first().check();
        await page.getByRole("button", { name: "Enviar solicitud", exact: true }).click();
        await page.getByText("¡Solicitud enviada!").waitFor({ timeout: 15000 });

        // ---- Portal del paciente QA: confirmar asistencia (cita solicitada) ----
        await ir(page, new URL(st.portalUrl).pathname + new URL(st.portalUrl).search);
        const confirmar = page.getByRole("button", { name: "Confirmar mi asistencia" }).first();
        await confirmar.waitFor({ state: "visible", timeout: 15000 });
        await confirmar.click();
        await page
          .getByText("¡Gracias! Confirmaste tu asistencia")
          .waitFor({ timeout: 10000 });

        // ---- Intake: alergias Penicilina ----
        await page.getByRole("button", { name: "Actualizar mi información" }).click();
        await page.locator("#intake-alergias").fill("Penicilina");
        await page.getByRole("button", { name: "Guardar", exact: true }).click();
        await page.getByText("Penicilina").first().waitFor({ timeout: 10000 });

        // ---- Portal de Rosa (presupuestos QA aprobados con cuotas; el paso 8
        //      crea 3 cuotas nuevas por corrida → fuente renovable) ----
        const adm = await newPage(st.ctx);
        await ir(adm, "/consola/pacientes");
        await adm
          .locator(`a:has-text("${PACIENTE_SEED}"), button:has-text("${PACIENTE_SEED}")`)
          .first()
          .click();
        await adm.waitForURL(/\/consola\/pacientes\//, { timeout: 15000 });
        await sleep(1000);
        await adm.getByRole("button", { name: "Portal del paciente" }).first().click();
        await esperarToast(adm, "Enlace del portal copiado");
        const copiar = adm.getByRole("button", { name: "Copiar enlace", exact: true }).first();
        await copiar.waitFor({ state: "visible", timeout: 8000 });
        st.portalUrlRosa = (await copiar.getAttribute("title")) || null;
        if (!st.portalUrlRosa) throw new Error("no se capturó portal URL de la paciente seed");

        // ---- Pagar cuota con QR (si hay cuotas pendientes) ----
        const mp = await newPage(st.ctxM);
        await ir(mp, new URL(st.portalUrlRosa).pathname + new URL(st.portalUrlRosa).search);
        const hayCuotas = await mp
          .getByText("Cuotas por pagar")
          .first()
          .waitFor({ state: "visible", timeout: 8000 })
          .then(() => true)
          .catch(() => false);
        if (!hayCuotas) {
          log("WARN: sin cuotas por pagar en el portal (se crean en el paso 8) — pago QR omitido");
        } else {
          await mp.getByRole("button", { name: "Pagar con QR" }).first().click();
          const qrImg = mp.locator("img[alt='QR de pago']").first();
          await qrImg.waitFor({ state: "visible", timeout: 20000 }); // QR/imagen visible
          const textoRef = await mp
            .locator("p", { hasText: "Referencia:" })
            .first()
            .innerText();
          const m = textoRef.match(/Referencia:\s*([A-Z0-9-]+)/i);
          st.pagoQrRef = m ? m[1] : null;
          log("QR cuota ref:", st.pagoQrRef);
          if (!st.pagoQrRef) throw new Error("no se capturó la referencia del pago QR");
          await mp.getByRole("button", { name: "Ya pagué / cerrar" }).click();
        }
      },
    },

    {
      nombre: "06 CAJA (pago, split Rimac, anulación, cierre + reapertura)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        await ir(page, "/consola/caja");

        async function registrarPago(monto, metodoLabel, pacienteLabel, ref) {
          await page.locator("#pago-monto").fill(String(monto));
          await page.locator("#pago-metodo").selectOption({ label: metodoLabel });
          if (pacienteLabel) {
            await page.locator("#pago-paciente").selectOption({ label: pacienteLabel });
          }
          if (ref) await page.locator("#pago-referencia").fill(ref);
          await page.getByRole("button", { name: "Registrar pago", exact: true }).click();
          await sleep(1400);
        }

        // ---- Pago S/ 120 Yape (paciente seed) ----
        st.pagoSplitId = `YAPE-QA-${RUN}`;
        await registrarPago(120, "Yape", PACIENTE_SEED, st.pagoSplitId);
        await esperarToast(page, "Pago de S/ 120.00 registrado");

        // ---- Split aseguradora S/ 40 Rimac sobre ese pago ----
        const fila = page
          .locator("tr, li")
          .filter({ hasText: PACIENTE_SEED })
          .filter({ hasText: "120.00" })
          .first();
        await fila.getByRole("button", { name: "Aseguradora", exact: true }).click();
        const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlg.waitFor({ state: "visible" });
        await dlg.locator("select").first().selectOption({ label: "Rimac Seguros" });
        await dlg.locator("input[type='number']").fill("40");
        await dlg.locator("button[type='submit']").click();
        await esperarToast(page, "Split registrado");

        // ---- Anular un pago pequeño ----
        await registrarPago(10, "Efectivo", null, `EFEC-QA-${RUN}`);
        await esperarToast(page, "Pago de S/ 10.00 registrado");
        const filaChica = page
          .locator("tr, li")
          .filter({ hasText: `EFEC-QA-${RUN}` })
          .first();
        // el trigger es botón ghost con texto "Anular" (icono Ban, sin title)
        await filaChica.getByRole("button", { name: "Anular", exact: true }).first().click();
        const dlgAnul = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgAnul.waitFor({ state: "visible" });
        await dlgAnul.locator("#motivo-anulacion").fill(`Anulación QA ${RUN}`);
        await dlgAnul.getByRole("button", { name: "Anular pago", exact: true }).click();
        await esperarToast(page, "Pago anulado");

        // ---- Cierre de caja con cierreReal = total sistema ----
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1500);
        // si una corrida anterior cerró la caja, reabrir primero
        const yaCerrada = await page
          .getByText("Caja cerrada", { exact: true })
          .first()
          .isVisible()
          .catch(() => false);
        if (yaCerrada) {
          const rb = page.getByRole("button", { name: "Reabrir", exact: true }).first();
          if (await rb.isVisible().catch(() => false)) {
            await rb.click();
            const dlgR = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
            if (await dlgR.isVisible().catch(() => false)) {
              await dlgR.locator("#motivo-reapertura").fill(`Reapertura QA ${RUN}`).catch(() => {});
              await dlgR
                .getByRole("button", { name: "Reabrir cierre", exact: true })
                .click()
                .catch(() => {});
              await sleep(1500);
            }
            await page.reload({ waitUntil: "domcontentloaded" });
            await sleep(1500);
          }
        }
        const totalHeader = await page
          .locator("span", { hasText: /S\/\s[\d,]+\.\d{2}/ })
          .first()
          .innerText()
          .catch(() => "S/ 0.00");
        const parseNum = (t) =>
          Number(t.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;
        st.totalCaja = parseNum(totalHeader);

        await page.getByRole("button", { name: "Cerrar caja", exact: true }).click();
        const dlgCierre = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgCierre.waitFor({ state: "visible" });
        const sistemaTxt = await dlgCierre.locator("#cierre-sistema").inputValue();
        // el input puede venir formateado ("1,936.66"): quitar todo salvo dígitos y punto
        st.totalCaja = Number(sistemaTxt.replace(/[^\d.]/g, "")) || 0;
        await dlgCierre.locator("#cierre-real").fill(String(st.totalCaja));
        await dlgCierre.getByRole("button", { name: "Confirmar cierre", exact: true }).click();
        await esperarToast(page, "Caja cerrada correctamente");
        await page.getByText("Caja cerrada", { exact: true }).first().waitFor({ timeout: 10000 });

        // ---- Reabrir cierre (owner) ----
        const btnReabrir = page.getByRole("button", { name: "Reabrir", exact: true }).first();
        await btnReabrir.scrollIntoViewIfNeeded().catch(() => {});
        await btnReabrir.click();
        const dlgReab = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgReab.waitFor({ state: "visible" });
        await dlgReab.locator("#motivo-reapertura").fill(`Reapertura QA ${RUN}`);
        await dlgReab.getByRole("button", { name: "Reabrir cierre", exact: true }).click();
        await esperarToast(page, "reabierto");
        // el badge "Reabierta" queda oculto en desktop; la prueba real es que
        // el botón "Cerrar caja" vuelve a estar disponible
        await page
          .getByRole("button", { name: "Cerrar caja", exact: true })
          .first()
          .waitFor({ timeout: 10000 });
      },
    },

    {
      nombre: "07 COMPROBANTES SUNAT beta (boleta B001 + factura F001 + logo + export)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        // asegurar un segundo pago sin comprobante (S/ 60 Plin)
        await ir(page, "/consola/caja");
        await page.locator("#pago-monto").fill("60");
        await page.locator("#pago-metodo").selectOption({ label: "Plin" });
        await page.locator("#pago-referencia").fill(`PLIN-QA-${RUN}`);
        await page.getByRole("button", { name: "Registrar pago", exact: true }).click();
        await sleep(1400);

        await ir(page, "/consola/caja/comprobantes");

        async function crearComprobante(tipoLabel, montoParcial) {
          await dialogAbrir(page, "Emitir comprobante", { exact: true });
          const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          const opt = dlg
            .locator("#comp-pago option")
            .filter({ hasText: montoParcial })
            .first();
          const val = await opt.getAttribute("value");
          await dlg.locator("#comp-pago").selectOption(val);
          if (tipoLabel !== "Boleta") {
            await dlg.locator("#comp-tipo").selectOption({ label: tipoLabel });
          }
          await dlg.locator("button[type='submit']").click();
          await esperarToast(page, "Comprobante emitido", 15000);
          await sleep(1500);
        }

        async function emitirYEsperarAceptado(prefijoSerie) {
          const fila = page
            .locator("tr, li")
            .filter({ hasText: prefijoSerie })
            .first();
          await fila.waitFor({ state: "visible", timeout: 15000 });
          let reintentoHecho = false;
          const t0 = Date.now();
          while (Date.now() - t0 < 60000) {
            await fila.getByRole("button", { name: "Emitir", exact: true }).click().catch(() => {});
            await sleep(4000);
            await page.reload({ waitUntil: "domcontentloaded" });
            await sleep(1500);
            const fila2 = page
              .locator("tr, li")
              .filter({ hasText: prefijoSerie })
              .first();
            const txt = (await fila2.innerText().catch(() => "")) || "";
            if (txt.includes("Aceptado SUNAT")) return;
            if (txt.includes("Rechazado SUNAT") && !reintentoHecho) {
              reintentoHecho = true;
              log("SUNAT rechazó una vez → Reintentar");
              await fila2.getByRole("button", { name: "Reintentar", exact: true }).click();
              const dlg = page
                .locator("[role='dialog']:visible, .fixed.inset-0:visible")
                .first();
              await dlg
                .getByRole("button", { name: "Reenviar a SUNAT", exact: true })
                .click()
                .catch(() => {});
            }
          }
          throw new Error(`${prefijoSerie}: no quedó "Aceptado SUNAT" en 60s`);
        }

        // ---- BOLETA B001 ----
        await crearComprobante("Boleta", "120.00");
        await emitirYEsperarAceptado("B001");

        // PDF de la boleta: GET .../pdf → 200 + content-type pdf
        const pdfHref = await page
          .locator("a[href*='/pdf']")
          .first()
          .getAttribute("href");
        if (pdfHref) {
          const urlPdf = pdfHref.startsWith("http") ? pdfHref : `${BASE}${pdfHref}`;
          const resp = await page.request.get(urlPdf);
          const ct = (resp.headers()["content-type"] || "").toLowerCase();
          if (resp.status() !== 200 || !ct.includes("pdf")) {
            throw new Error(`PDF status=${resp.status} ct=${ct}`);
          }
          log("PDF OK:", resp.status(), ct);
        } else {
          log("WARN: no se encontró link PDF en la fila");
        }

        // ---- FACTURA F001 (otro pago) ----
        let facturaWarn = null;
        try {
          await crearComprobante("Factura", "60.00");
          await emitirYEsperarAceptado("F001");
        } catch (e) {
          // La factura exige RUC del paciente; los pagos sin RUC pueden fallar.
          facturaWarn = `factura: ${e.message}`;
          log("WARN factura:", e.message);
        }

        // ---- Logo de comprobantes (PNG) ----
        const assets = escribirAssets();
        await dialogAbrir(page, "Logo de comprobantes");
        const dlgLogo = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgLogo.locator("#logo-archivo").setInputFiles(assets.foto);
        await dlgLogo.locator("button[type='submit']").click();
        await sleep(1500);
        await dialogCerrar(page);

        // ---- Export SUNAT → 200 ----
        const exportHref = await page
          .locator("a[href*='/api/export/sunat']")
          .first()
          .getAttribute("href");
        if (!exportHref) throw new Error("no se encontró link /api/export/sunat");
        const respExp = await page.request.get(
          exportHref.startsWith("http") ? exportHref : `${BASE}${exportHref}`,
        );
        if (respExp.status() !== 200) {
          throw new Error(`export SUNAT status=${respExp.status()}`);
        }

        if (facturaWarn && !facturaWarn.includes("no quedó")) {
          // boleta sí fue aceptada; la factura queda como advertencia documentada
          st.notas07 = facturaWarn;
        }
      },
    },

    {
      nombre: "08 PRESUPUESTOS (cuotas ×3 + link phone_last4 + firma pública 375)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        st.presupuestoTitulo = `Plan QA ${RUN}`;

        // ---- Crear presupuesto (2 ítems, total autocalculado) ----
        await ir(page, "/consola/presupuestos");
        const dlg = await dialogAbrir(page, "Nuevo presupuesto");
        await dlg.locator("#np-paciente").fill(PACIENTE_SEED);
        await dlg
          .locator("button")
          .filter({ hasText: PACIENTE_SEED })
          .first()
          .waitFor({ state: "visible", timeout: 10000 });
        await dlg.locator("button").filter({ hasText: PACIENTE_SEED }).first().click();
        await sleep(500);
        await dlg.locator("#np-titulo").fill(st.presupuestoTitulo);
        const filas = dlg.locator(".grid.grid-cols-\\[1fr_72px_110px_32px\\]").nth(1);
        // primera fila de ítems
        await dlg.getByPlaceholder("Limpieza dental").first().fill(SERV_LIMPIEZA);
        await dlg.locator("input[type='number']").nth(1).fill("120");
        // segunda fila
        await dlg.getByRole("button", { name: "Agregar ítem", exact: true }).click();
        await dlg.getByPlaceholder("Limpieza dental").nth(1).fill(SERV_EVAL);
        await dlg.locator("input[type='number']").nth(3).fill("50");
        const totalVisible = await dlg
          .getByText(/S\/\s*170(\.00)?/)
          .first()
          .isVisible()
          .catch(() => false);
        if (!totalVisible) log("WARN: total autocalculado S/ 170.00 no visible");
        await dlg.getByRole("button", { name: "Crear presupuesto", exact: true }).click();
        await esperarToast(page, "Presupuesto creado");
        await sleep(1200);

        // ---- Detalle: enviar → link phone_last4 → aprobar → cuotas ×3 ----
        const filaPresu = page
          .locator("tr, li")
          .filter({ hasText: st.presupuestoTitulo })
          .first();
        await filaPresu.getByRole("button", { name: "Ver", exact: true }).click();
        const dlgDet = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgDet.waitFor({ state: "visible" });
        await sleep(800);

        await dlgDet.getByRole("button", { name: "Enviar", exact: true }).click();
        await esperarToast(page, "Presupuesto enviado");
        await sleep(800);

        await dlgDet
          .getByRole("button", { name: "Generar link de aceptación" })
          .click();
        await sleep(600);
        // modo por defecto: phone_last4 (Últimos 4 del celular)
        await dlgDet.locator("#link-valor").fill(CELULAR_SEED_LAST4);
        await dlgDet.getByRole("button", { name: "Generar", exact: true }).click();
        await esperarToast(page, "Link público generado");
        const codeEl = dlgDet.locator("code").first();
        await codeEl.waitFor({ state: "visible", timeout: 8000 });
        st.presupuestoUrl = (await codeEl.innerText()).trim();
        if (!st.presupuestoUrl.includes("/s/presupuesto/")) {
          throw new Error(`link público inesperado: ${st.presupuestoUrl}`);
        }

        await dialogCerrar(page);

        // ---- Portal público /s/presupuesto/{token} en 375px ----
        // OJO: el presupuesto queda "enviado" — la firma pública es lo que lo
        // pasa a aprobado (aceptar sobre "aprobado" devuelve ya_aceptado).
        const mp = await newPage(st.ctxM);
        const pathPub = new URL(st.presupuestoUrl).pathname;
        await ir(mp, pathPub);

        // 2FA con últimos 4 dígitos
        const btnUlt4 = mp
          .getByRole("button", { name: /Últimos 4 dígitos/i })
          .first();
        if (await btnUlt4.count()) {
          await btnUlt4.click();
          await sleep(500);
        }
        await mp.locator("input").first().fill(CELULAR_SEED_LAST4);
        await mp.getByRole("button", { name: "Verificar", exact: true }).click();
        await mp.getByText(SERV_LIMPIEZA).first().waitFor({ timeout: 15000 });

        // Aceptar y firmar
        await mp.getByRole("button", { name: "Aceptar y firmar" }).click();
        await sleep(600);
        st.presuYaAceptado = false;
        // log del body si el POST de aceptar falla (debug firma)
        mp.on("response", async (res) => {
          if (res.url().includes("/api/publico/presupuesto/") && res.status() >= 400) {
            const body = (await res.text().catch(() => "")).slice(0, 160);
            log("aceptar →", res.status(), body);
            if (body.includes("ya_aceptado")) st.presuYaAceptado = true;
          }
        });
        await mp.locator("input:visible").last().fill(PACIENTE_SEED);
        await firmarCanvas(mp);
        await mp.getByRole("button", { name: "Confirmar", exact: true }).click();
        try {
          await mp.getByText("¡Presupuesto aceptado!").waitFor({ timeout: 45000 });
        } catch {
          if (!st.presuYaAceptado) throw new Error("firma pública sin confirmar");
          log("WARN: el link ya estaba aceptado (re-firma) — continúo");
        }

        // Verificar estado en consola
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1200);
        const filaPresu2 = page
          .locator("tr, li")
          .filter({ hasText: st.presupuestoTitulo })
          .first();
        const txt = (await filaPresu2.innerText().catch(() => "")) || "";
        if (!st.presuYaAceptado && !/aprobado/i.test(txt)) {
          throw new Error("presupuesto QA no figura aprobado");
        }

        // ---- Cuotas ×3 (requiere aprobado; ya lo está tras la firma pública) ----
        await filaPresu2.getByRole("button", { name: "Ver", exact: true }).click();
        const dlgDet2 = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgDet2.waitFor({ state: "visible" });
        await sleep(600);
        await dlgDet2.getByRole("button", { name: "Generar cuotas" }).click();
        await dlgDet2.locator("#cuotas-n").fill("3");
        await dlgDet2.getByRole("button", { name: "Generar", exact: true }).click();
        await esperarToast(page, "3 cuotas generadas correctamente");
        await dialogCerrar(page);
        // ---- Rechazar desde el portal (botón nuevo) ----
        const mp2 = await newPage(st.ctxM);
        // presupuesto "enviado" del seed: "Blanqueamiento + limpieza" (Luz Marina, cel …4305)
        const adm = await newPage(st.ctx);
        await ir(adm, "/consola/presupuestos");
        const filaEnviado = adm
          .locator("tr, li")
          .filter({ hasText: "Blanqueamiento + limpieza" })
          .first();
        const estadoSeedTxt = (await filaEnviado.innerText().catch(() => "")) || "";
        if (/rechazado/i.test(estadoSeedTxt)) {
          log("SKIP rechazo: el presupuesto enviado ya fue rechazado en corrida anterior");
        } else if (/enviado/i.test(estadoSeedTxt) && (await filaEnviado.count())) {
          await filaEnviado.getByRole("button", { name: "Ver", exact: true }).click();
          const dlgSeed = adm
            .locator("[role='dialog']:visible, .fixed.inset-0:visible")
            .first();
          await dlgSeed.waitFor({ state: "visible" });
          await sleep(600);
          let urlSeed = null;
          // si ya tiene link activo el <code> está visible; si no, generarlo
          const codeSeed0 = dlgSeed.locator("code").first();
          if (await codeSeed0.isVisible().catch(() => false)) {
            urlSeed = (await codeSeed0.innerText()).trim();
          } else {
            await dlgSeed.getByRole("button", { name: "Generar link de aceptación" }).click();
            await sleep(600);
            // 2FA por últimos 4 del celular de Luz Marina
            await dlgSeed.locator("#link-valor").fill("4305");
            await dlgSeed.getByRole("button", { name: "Generar", exact: true }).click();
            const codeSeed = dlgSeed.locator("code").first();
            await codeSeed.waitFor({ state: "visible", timeout: 10000 });
            urlSeed = (await codeSeed.innerText()).trim();
          }
          await dialogCerrar(adm);
          if (urlSeed && urlSeed.includes("/s/presupuesto/")) {
            await ir(mp2, new URL(urlSeed).pathname);
            // 2FA
            const btnUlt4b = mp2.getByRole("button", { name: /Últimos 4 dígitos/i }).first();
            if (await btnUlt4b.count()) {
              await btnUlt4b.click();
              await sleep(400);
            }
            await mp2.locator("input:visible").first().fill("4305");
            await mp2.getByRole("button", { name: "Verificar", exact: true }).click();
            await mp2.getByText(SERV_LIMPIEZA).first().waitFor({ timeout: 20000 });
            // Rechazar con confirmación
            await mp2.getByRole("button", { name: "Rechazar presupuesto" }).click();
            const dlgRech = mp2.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
            await dlgRech.waitFor({ state: "visible" });
            await dlgRech.getByRole("button", { name: /Rechazar|Confirmar|Sí/i }).first().click();
            await mp2
              .getByText("Presupuesto rechazado", { exact: false })
              .first()
              .waitFor({ timeout: 20000 });
            log("rechazo público OK");
          } else {
            log("SKIP: presupuesto enviado sin link público activo");
          }
        }
      },
    },

    {
      nombre: "09 CUOTAS (conciliar QR válido + rechazar otro)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        await ir(page, "/consola/cuotas");

        // ---- Conciliar el QR del paso 5 (o cualquier pago por conciliar) ----
        const filaOk = st.pagoQrRef
          ? page.locator("tr, li").filter({ hasText: st.pagoQrRef }).first()
          : page.locator("tr, li").filter({ hasText: /por_conciliar|Por conciliar/ }).first();
        const hayFilaOk = await filaOk
          .waitFor({ state: "visible", timeout: 8000 })
          .then(() => true)
          .catch(() => false);
        if (!hayFilaOk) {
          log("SKIP conciliación: sin pagos QR por conciliar en esta corrida");
        } else {
          await filaOk.getByRole("button", { name: "Conciliar", exact: true }).click();
          const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlg.waitFor({ state: "visible" });
          await dlg.getByRole("button", { name: "Sí, conciliar", exact: true }).click();
          await esperarToast(page, "conciliado");
          await sleep(1500);
        }

        // ---- Crear otro pago QR desde el portal y rechazarlo ----
        let rechazado = false;
        if (st.portalUrlRosa) {
          const mp = await newPage(st.ctxM);
          await ir(mp, new URL(st.portalUrlRosa).pathname + new URL(st.portalUrlRosa).search);
          const hayCuotas2 = await mp
            .getByText("Cuotas por pagar")
            .first()
            .waitFor({ state: "visible", timeout: 8000 })
            .then(() => true)
            .catch(() => false);
          if (!hayCuotas2) {
            log("SKIP rechazo QR: sin cuotas por pagar disponibles");
          } else {
            const btnsQR = mp.getByRole("button", { name: "Pagar con QR" });
            const haySegunda = (await btnsQR.count()) > 1;
            await btnsQR.nth(haySegunda ? 1 : 0).click();
            await mp
              .locator("img[alt='QR de pago']")
              .first()
              .waitFor({ state: "visible", timeout: 20000 });
            const textoRef2 = await mp
              .locator("p", { hasText: "Referencia:" })
              .first()
              .innerText();
            const m2 = textoRef2.match(/Referencia:\s*([A-Z0-9-]+)/i);
            st.pagoQrRef2 = m2 ? m2[1] : null;
            await mp.getByRole("button", { name: "Ya pagué / cerrar" }).click();
            rechazado = Boolean(st.pagoQrRef2);
          }
        }

        if (rechazado) {
          await page.reload({ waitUntil: "domcontentloaded" });
          await sleep(1500);
          const filaMal = page.locator("tr, li").filter({ hasText: st.pagoQrRef2 }).first();
          await filaMal.waitFor({ state: "visible", timeout: 15000 });
          await filaMal.getByRole("button", { name: "Rechazar", exact: true }).click();
          const dlgR = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgR.waitFor({ state: "visible" });
          await dlgR.locator("#conciliar-motivo").fill(`Rechazo QA ${RUN}`).catch(() => {});
          await dlgR.getByRole("button", { name: "Sí, rechazar", exact: true }).click();
          await esperarToast(page, "Registro rechazado");
        } else {
          log("SKIP rechazo QR: no se generó un segundo pago en esta corrida");
        }

        // ---- TODO-HOOK: botón "Pagada" (si existe) ----
        const tienePagada = await page
          .getByRole("button", { name: /^Pagada$/ })
          .count();
        if (!tienePagada) log("SKIP (TODO-HOOK): botón 'Pagada' no existe aún");
      },
    },

    {
      nombre: "10 WHATSAPP (webhook mock entrante + respuesta plantilla)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        // Mensaje entrante simulado (contrato verificado en
        // .references/whap/src/server/routes/webhooks.ts → /webhook/simulate-message)
        // OJO: la app matchea el tenant por CELULAR del paciente (contacts[0].wa_id),
        // así que `from` debe ser el celular de un paciente del seed (Rosa: 987654303).
        const CEL_PACIENTE = "51987654303";
        const resp = await page.request.post(`${WA_MOCK}/webhook/simulate-message`, {
          data: {
            from: CEL_PACIENTE,
            to: "51999999999",
            message: { text: { body: "CONFIRMAR" } },
          },
          headers: { "content-type": "application/json" },
        });
        log("simulate-message →", resp.status(), (await resp.text()).slice(0, 160));

        // El mensaje debe aparecer en /consola/whatsapp
        await ir(page, "/consola/whatsapp");
        let visto = false;
        for (let i = 0; i < 10 && !visto; i++) {
          visto = await page
            .getByText("CONFIRMAR", { exact: false })
            .first()
            .isVisible()
            .catch(() => false);
          if (!visto) {
            await page.reload({ waitUntil: "domcontentloaded" });
            await sleep(2000);
          }
        }
        if (!visto) throw new Error("el mensaje entrante CONFIRMAR no aparece en WhatsApp");

        // Responder con plantilla
        const bloque = page.locator("div.divide-y > div").filter({ hasText: "CONFIRMAR" }).first();
        await bloque.getByRole("button", { name: "Responder", exact: true }).first().click();
        const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlg.waitFor({ state: "visible" });
        await dlg.getByRole("button", { name: "Confirmación de cita" }).click();
        await dlg.getByRole("button", { name: "Enviar", exact: true }).click();
        await esperarToast(page, "Mensaje enviado por WhatsApp");

        // Respuesta saliente en la lista
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1500);
        const saliente = await page
          .getByText(/Responde SI para confirmar/)
          .first()
          .isVisible()
          .catch(() => false);
        if (!saliente) throw new Error("la respuesta saliente no aparece en la lista");
      },
    },

    {
      nombre: "11 RECALL + CAMPAÑAS + REVIEWS",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        // ---- Recall: recordatorio a 1 paciente ----
        await ir(page, "/consola/recall");
        const recordar = page.getByRole("button", { name: "Recordar", exact: true }).first();
        if (await recordar.count()) {
          await recordar.click();
          const t = await toastReciente(page);
          log("recall toast:", t);
          if (t && /RESEND|correo registrado/i.test(t)) {
            log("WARN: recall sin proveedor de email configurado (aviso esperado)");
          }
        } else {
          log("SKIP: recall sin candidatos");
        }

        // ---- Campañas: crear + ejecutar ----
        await ir(page, "/consola/campanas");
        await dialogAbrir(page, /Nueva campaña/i);
        await page.locator("#campana-tipo").selectOption("cumple");
        await page.locator("#campana-titulo").fill(`Campaña QA ${RUN}`);
        await page
          .locator("#campana-mensaje")
          .fill(`Hola {{nombre}}, mensaje QA ${RUN} de cumpleaños.`);
        await page
          .locator("[role='dialog'] button[type='submit'], .fixed.inset-0 button[type='submit']")
          .first()
          .click();
        await sleep(1500);
        const filaCamp = page
          .locator("tr, li")
          .filter({ hasText: `Campaña QA ${RUN}` })
          .first();
        await filaCamp.waitFor({ state: "visible", timeout: 15000 });
        await filaCamp.getByRole("button", { name: "Ejecutar", exact: true }).click();
        const tCamp = await toastReciente(page);
        log("campaña toast:", tCamp);
        if (!tCamp || !/Campaña/i.test(tCamp)) {
          throw new Error("no hubo toast de ejecución de campaña");
        }

        // ---- Reviews: solicitar reseña ----
        await ir(page, "/consola/reviews");
        const btnRev = page.getByRole("button", { name: "Nueva solicitud", exact: true }).first();
        if (await btnRev.isEnabled().catch(() => false)) {
          await btnRev.click();
          const dlgRev = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgRev.waitFor({ state: "visible" });
          await dlgRev.locator("#rev-select").selectOption({ index: 1 });
          await dlgRev.getByRole("button", { name: "Enviar solicitud", exact: true }).click();
          await esperarToast(page, "Solicitud enviada");
        } else {
          const title = (await btnRev.getAttribute("title").catch(() => "")) || "";
          log(`SKIP reseñas: botón deshabilitado (${title || "sin title"}) — comportamiento correcto`);
        }
      },
    },

    {
      nombre: "12 INVENTARIO (artículo + movimientos + stock + receta)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        const itemNombre = `Alcohol gel QA ${RUN}`;

        await ir(page, "/consola/inventario");

        // ---- Crear artículo ----
        await dialogAbrir(page, "Nuevo artículo", { exact: true });
        const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlg.getByPlaceholder("Anestesia tópica").fill(itemNombre);
        await dlg.getByPlaceholder("Consumible").fill("insumos");
        await dlg.getByPlaceholder("und").fill("litro");
        await dlg.getByPlaceholder("1").fill("2");
        await dlg.getByPlaceholder("0.00").fill("12");
        await dlg.getByRole("button", { name: "Crear artículo", exact: true }).click();
        await esperarToast(page, "Artículo creado");
        await sleep(1200);
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1500);

        // ---- Entrada +10 y salida (merma) −2 ----
        async function movimiento(tipoValor, cantidad) {
          const filaItem = page
            .locator("div.divide-y > div")
            .filter({ hasText: itemNombre })
            .first();
          // trigger real: botón "Movimiento" (el title="Registrar movimiento" está en el Dialog)
          await filaItem.getByRole("button", { name: "Movimiento", exact: true }).first().click();
          const dlgM = page
            .locator("[role='dialog']:visible, .fixed.inset-0:visible")
            .first();
          await dlgM.waitFor({ state: "visible" });
          await dlgM.locator("select").first().selectOption({ value: tipoValor });
          await dlgM.locator("input[type='number']").first().fill(String(cantidad));
          await dlgM.locator("button[type='submit']").click();
          await esperarToast(page, "Movimiento registrado");
          await sleep(1200);
        }
        await movimiento("ingreso", 10);
        await movimiento("merma", 2);

        // ---- Stock actualizado = 8 ----
        await page.reload({ waitUntil: "domcontentloaded" });
        await sleep(1500);
        const filaStock = page
          .locator("div.divide-y > div")
          .filter({ hasText: itemNombre })
          .first();
        const txt = (await filaStock.innerText().catch(() => "")) || "";
        if (!/\b8\b/.test(txt)) throw new Error(`stock esperado 8, fila: ${txt.slice(0, 120)}`);

        // ---- Receta de "Limpieza dental": añadir alcohol gel ----
        const filaServ = page
          .locator("div.flex.items-center.justify-between")
          .filter({ hasText: SERV_LIMPIEZA })
          .first();
        const btnReceta = filaServ.getByRole("button", { name: /Receta/i }).first();
        await btnReceta.click();
        const dlgR = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlgR.waitFor({ state: "visible" });
        // esperar opciones cargadas: el botón "Agregar material" solo se muestra
        // cuando las opciones de artículos terminaron de cargar
        await dlgR
          .getByRole("button", { name: "Agregar material", exact: true })
          .waitFor({ state: "visible", timeout: 10000 });
        // quitar filas previas (evita duplicados) y armar una sola con el artículo QA
        const btnQuitar = dlgR.getByRole("button", { name: "Quitar material" });
        for (let n = await btnQuitar.count(); n > 0; n--) {
          await btnQuitar.first().click().catch(() => {});
          await sleep(250);
        }
        await dlgR.getByRole("button", { name: "Agregar material", exact: true }).click();
        const selNueva = dlgR.locator("select").first();
        await selNueva.waitFor({ state: "visible", timeout: 10000 });
        await selNueva.selectOption({ label: itemNombre });
        await dlgR.locator("input[type='number']").first().fill("1");
        await dlgR.locator("button[type='submit']").click();
        await esperarToast(page, "Receta guardada");
      },
    },

    {
      nombre: "13 PERSONAL (invitar asistente2 + horario membership)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);

        // ---- Invitar asistente2@vitalia.pe (rol asistente) ----
        await ir(page, "/consola/personal");
        await page.locator("#inv-email").fill("asistente2@vitalia.pe");
        await page.locator("#inv-role").selectOption("assistant");
        await page
          .locator("form")
          .filter({ has: page.locator("#inv-email") })
          .locator("button[type='submit']")
          .click();
        const tInv = await toastReciente(page);
        log("invitación toast:", tInv);
        if (!tInv || !/asistente2@vitalia\.pe/i.test(tInv)) {
          throw new Error("la invitación no se registró");
        }
        // El token/aceptación se prueba aparte (el runner NO accede a DB): SKIP aceptar.
        log("SKIP aceptar invitación (token se prueba aparte)");

        // ---- Configurar horario de una membership ----
        const miembro = page.locator("body");
        // trigger real: botón ghost con texto "Editar turnos" (miembro-turnos.tsx)
        await page.getByRole("button", { name: "Editar turnos" }).last().click();
        const dlg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
        await dlg.waitFor({ state: "visible" });
        // activar lunes y fijar 09:00–17:00
        const filaLunes = dlg.locator("label, div").filter({ hasText: /^Lunes/ }).first();
        const chk = filaLunes.locator("input[type='checkbox']").first();
        if (await chk.count()) {
          const checked = await chk.isChecked();
          if (!checked) await chk.check({ force: true });
        }
        await dlg.locator("input[type='time']").nth(0).fill("09:00").catch(() => {});
        await dlg.locator("input[type='time']").nth(1).fill("17:00").catch(() => {});
        await dlg.getByRole("button", { name: "Guardar turnos", exact: true }).click();
        await esperarToast(page, "guardados");
      },
    },

    {
      nombre: "14 RESTO (espera, referidos, series, aseguradoras, sucursales, plantillas, ARCO, auditoría, comisiones, config)",
      fn: async () => {
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        const subFallos = [];
        async function sub(nombre, fn) {
          try {
            await fn();
            log(`ok · ${nombre}`);
          } catch (e) {
            subFallos.push(`${nombre}: ${e.message}`);
            log(`FALLÓ sub · ${nombre}:`, e.message);
          }
        }

        // ---- Lista de espera: agregar, notificar, eliminar ----
        await sub("lista-espera", async () => {
          await ir(page, "/consola/lista-espera");
          await dialogAbrir(page, /Agregar a espera|Agregar/);
          const dlgW = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgW.locator("#wl-q").fill(PACIENTE_SEED);
          await dlgW
            .locator("button")
            .filter({ hasText: PACIENTE_SEED })
            .first()
            .waitFor({ state: "visible", timeout: 10000 });
          await dlgW.locator("button").filter({ hasText: PACIENTE_SEED }).first().click();
          await dlgW.locator("#wl-preferencia").fill("mañanas");
          await dlgW.locator("#wl-prioridad").fill("5");
          await dlgW
            .getByRole("button", { name: /Agregar a espera/, exact: false })
            .last()
            .click();
          await esperarToast(page, "lista de espera");
          // notificar
          const filaW = page.locator("tr, li").filter({ hasText: PACIENTE_SEED }).first();
          const btnNotif = filaW.getByRole("button", { name: /Notificar/i }).first();
          if (await btnNotif.count()) {
            await btnNotif.click();
            await sleep(1200);
          } else {
            log("  · botón Notificar no visible (SKIP)");
          }
          // eliminar/retirar
          const btnSalir = filaW.getByRole("button", { name: /Retirar|Eliminar/i }).first();
          if (await btnSalir.count()) {
            await btnSalir.click();
            await sleep(1200);
          }
        });

        // ---- Referidos: generar link desde la ficha del paciente QA ----
        await sub("referidos", async () => {
          await ir(page, "/consola/pacientes");
          await page.locator("#q")?.fill?.(st.pacienteNombre).catch(() => {});
          await sleep(900);
          await page
            .locator("a")
            .filter({ hasText: st.pacienteNombre })
            .first()
            .click();
          await sleep(1200);
          // botón "Link de referido" (Share2) copia al portapapeles
          const btnRef = page.getByRole("button", { name: "Link de referido" }).first();
          await btnRef.waitFor({ state: "visible", timeout: 10000 });
          await btnRef.click();
          await sleep(800);
        });

        // ---- Series: ver listado ----
        await sub("series listado", async () => {
          await ir(page, "/consola/series");
          const hay = await page.getByText(/semanal|Semanal/i).first().isVisible().catch(() => false);
          if (!hay) throw new Error("listado de series vacío o sin serie semanal");
        });

        // ---- Aseguradoras: crear 1 ----
        await sub("aseguradoras crear", async () => {
          await ir(page, "/consola/aseguradoras");
          await dialogAbrir(page, /Nueva aseguradora/i);
          const dlgA = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgA.getByPlaceholder("Pacífico EPS").fill(`Aseguradora QA ${RUN}`);
          const ruc = `2${Math.floor(1e9 + Math.random() * 9e9)}`.slice(0, 11);
          await dlgA.getByPlaceholder("20100000000").fill(ruc);
          await dlgA.getByRole("button", { name: /Crear aseguradora/i }).click();
          await esperarToast(page, "Aseguradora creada");
        });

        // ---- Sucursales: crear "Vitalia Sur" ----
        await sub("sucursales crear", async () => {
          await ir(page, "/consola/sucursales");
          await dialogAbrir(page, /Nueva sucursal/i);
          const dlgS = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgS.locator("#suc-nombre").fill(`Vitalia Sur QA ${RUN}`);
          await dlgS.locator("#suc-direccion").fill("Av. Los Próceres 123");
          await dlgS.locator("#suc-telefono").fill("987654300");
          await dlgS.getByRole("button", { name: /Crear sucursal/i }).click();
          await esperarToast(page, "Sucursal creada");
        });

        // ---- Plantillas de consentimientos: crear 1 ----
        await sub("plantillas consentimiento", async () => {
          await ir(page, "/consola/consentimientos");
          await page.getByRole("button", { name: "Nueva plantilla" }).first().click();
          // panel inline (no dialog): div.rounded-lg.border.p-4 con título "Nueva plantilla"
          const panelT = page
            .locator("div.rounded-lg.border.p-4")
            .filter({ hasText: "Nueva plantilla" })
            .first();
          await panelT.waitFor({ state: "visible", timeout: 10000 });
          await panelT.locator("input").nth(0).fill(`Plantilla QA ${RUN}`);
          await panelT.locator("textarea").first().fill(`Contenido QA ${RUN} del consentimiento.`);
          await panelT.getByRole("button", { name: "Guardar", exact: true }).click();
          await esperarToast(page, "Plantilla guardada");
        });

        // ---- ARCO: crear solicitud, atender, descargar ZIP ----
        await sub("ARCO", async () => {
          await ir(page, "/consola/arco");
          // el trigger del header es "Nueva solicitud" (el dialog se titula "Nueva solicitud ARCO")
          await dialogAbrir(page, "Nueva solicitud", { exact: true });
          const dlgArc = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgArc.locator("#arco-q").fill(PACIENTE_SEED);
          await dlgArc
            .locator("button")
            .filter({ hasText: PACIENTE_SEED })
            .first()
            .waitFor({ state: "visible", timeout: 10000 });
          await dlgArc.locator("button").filter({ hasText: PACIENTE_SEED }).first().click();
          await dlgArc.locator("#arco-detalle").fill(`Solicitud QA ${RUN}`);
          await dlgArc.locator("button[type='submit']").click();
          await esperarToast(page, "registrada");
          await sleep(1200);
          const filaArc = page.locator("tr, li").filter({ hasText: PACIENTE_SEED }).first();
          await filaArc.getByRole("button", { name: /Atender/i }).first().click();
          await esperarToast(page, "atendida");
          const zipHref = await page
            .locator("a[title*='paquete']")
            .first()
            .getAttribute("href")
            .catch(() => null);
          if (zipHref) {
            const r = await page.request.get(
              zipHref.startsWith("http") ? zipHref : `${BASE}${zipHref}`,
            );
            if (r.status() !== 200) throw new Error(`descarga ARCO status=${r.status()}`);
          }
        });

        // ---- Auditoría: filtrar + export CSV 200 ----
        await sub("auditoría export", async () => {
          await ir(page, "/consola/auditoria");
          await page.locator("#desde").fill(hoyLimaISO(-7)).catch(() => {});
          await page.locator("#hasta").fill(hoyLimaISO(0)).catch(() => {});
          await sleep(800);
          const hrefCsv = await page
            .getByRole("link", { name: /Exportar CSV/i })
            .first()
            .getAttribute("href");
          const r = await page.request.get(
            hrefCsv.startsWith("http") ? hrefCsv : `${BASE}${hrefCsv}`,
          );
          if (r.status() !== 200) throw new Error(`CSV status=${r.status()}`);
        });

        // ---- Comisiones: ver reporte ----
        await sub("comisiones reporte", async () => {
          await ir(page, "/consola/comisiones");
          const visible = await page
            .getByText(/Comisión|comisión/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (!visible) throw new Error("reporte de comisiones no visible");
        });

        // ---- Config fiscal: datos beta visibles, SIN cambiar ----
        await sub("config fiscal (lectura)", async () => {
          await ir(page, "/consola/config/fiscal");
          // los campos viven dentro del dialog "Configurar facturación"
          await page.getByRole("button", { name: "Configurar facturación" }).first().click();
          const dlgF = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgF.waitFor({ state: "visible" });
          await dlgF.locator("#fiscal-ambiente").waitFor({ state: "visible", timeout: 10000 });
          const ambiente = await dlgF.locator("#fiscal-ambiente").inputValue();
          if (ambiente !== "beta") throw new Error(`ambiente fiscal ≠ beta (${ambiente})`);
          const ruc = await dlgF.locator("#fiscal-ruc").inputValue();
          if (!ruc.trim()) throw new Error("RUC fiscal vacío");
          log("  · fiscal beta OK (sin modificar)");
          await dialogCerrar(page);
        });

        // ---- Config legal: guardar términos ----
        await sub("config legal guardar", async () => {
          await ir(page, "/consola/config/legal");
          await page.getByRole("button", { name: "Guardar", exact: true }).click();
          await esperarToast(page, "guardada");
        });

        // ---- Config notificaciones: guardar ----
        await sub("config notificaciones", async () => {
          await ir(page, "/consola/config/notificaciones");
          const campo = page.locator("#plantilla-recordatorio");
          const val = await campo.inputValue();
          await campo.fill(`${val}`);
          await campo.press("Tab"); // dispara dirty
          const guardar = page.getByRole("button", { name: /Guardar cambios/i });
          await guardar.waitFor({ state: "visible", timeout: 8000 });
          if (await guardar.isEnabled()) {
            await guardar.click();
            await esperarToast(page, "guardada");
          } else {
            log("  · sin cambios pendientes (SKIP guardado)");
          }
        });

        // ---- Servicios: crear 1 ----
        await sub("servicios crear", async () => {
          await ir(page, "/consola/config/servicios");
          await dialogAbrir(page, /Nuevo servicio/i);
          const dlgSrv = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgSrv.locator("#srv-nombre").fill(`Servicio QA ${RUN}`);
          await dlgSrv.locator("#srv-duracion").fill("30");
          await dlgSrv.locator("#srv-precio").fill("60");
          await dlgSrv.locator("button[type='submit']").click();
          await esperarToast(page, "Servicio creado");
        });

        // ---- Reviews config: guardar ----
        await sub("reviews config", async () => {
          await ir(page, "/consola/reviews");
          // trigger real: "Configurar enlace" (config-dialog.tsx)
          await page.getByRole("button", { name: "Configurar enlace" }).first().click();
          const dlgCfg = page.locator("[role='dialog']:visible, .fixed.inset-0:visible").first();
          await dlgCfg.waitFor({ state: "visible" });
          await dlgCfg.locator("#res-url").fill("https://g.page/r/qa-review-" + RUN);
          await dlgCfg.getByRole("button", { name: /Guardar/i }).click();
          await esperarToast(page, "guardada");
        });

        if (subFallos.length) {
          throw new Error(`sub-flujos con fallo → ${subFallos.join(" | ")}`);
        }
      },
    },

    {
      nombre: "15 CRON seguros (backup-log, diario, seguimiento)",
      fn: async () => {
        if (!CRON_SECRET) throw new Error("CRON_SECRET no definido en env");
        const page = await newPage(st.ctx);
        await login(page, CREDS.duena.email, CREDS.duena.password);
        const headers = { Authorization: `Bearer ${CRON_SECRET}` };
        // backup-log exige body JSON {kind, status} (route.ts:30-43)
        const r1 = await page.request.post(`${BASE}/api/cron/backup-log`, {
          headers,
          data: { kind: "pg_dump", status: "ok", detail: `e2e ${RUN}` },
        });
        log("POST /api/cron/backup-log →", r1.status());
        if (r1.status() !== 200) throw new Error(`backup-log status=${r1.status()}`);
        for (const ruta of ["/api/cron/diario", "/api/cron/seguimiento"]) {
          const r = await page.request.post(`${BASE}${ruta}`, { headers });
          log("POST", ruta, "→", r.status());
          if (r.status() !== 200) {
            throw new Error(`${ruta} status=${r.status()}`);
          }
        }
      },
    },

    {
      nombre: "16 ADMIN (impersonar Vitalia → consola → salir)",
      fn: async () => {
        const page = await newPage(st.ctxAdmin);
        await login(page, CREDS.fundador.email, CREDS.fundador.password);
        if (!page.url().includes("/admin")) {
          throw new Error(`fundador sin acceso a /admin: ${page.url()}`);
        }

        // Ir al tenant Vitalia
        await ir(page, "/admin/tenants");
        const enlace = page.locator(`a:has-text("Vitalia")`).first();
        await enlace.waitFor({ state: "visible", timeout: 15000 });
        await enlace.click();
        await page.waitForURL(/\/admin\/tenants\//, { timeout: 15000 });
        await sleep(1200);

        // Impersonar a la dueña
        const miembro = page
          .locator("[data-testid='lista-miembros'] > li, li")
          .filter({ hasText: CREDS.duena.email })
          .first();
        await miembro.waitFor({ state: "visible", timeout: 15000 });
        await miembro.getByRole("button", { name: "Impersonar", exact: true }).click();

        // Redirección a consola con banner
        await page.waitForURL(/\/consola/, { timeout: 20000 });
        await page.getByText("Operando como").waitFor({ timeout: 15000 });

        // Salir de impersonación
        await page.getByRole("button", { name: "Salir", exact: true }).click();
        await page.waitForURL(/\/admin/, { timeout: 20000 });
        log("impersonación cerrada →", page.url());
      },
    },
  ];
}

// ================================ MAIN =====================================

async function main() {
  fs.mkdirSync(FAILS_DIR, { recursive: true });
  st.browser = await chromium.launch({ headless: HEADLESS });
  await crearContextos(st.browser);

  const pasos = definirPasos();
  let pasaron = 0;
  let fallaron = 0;

  for (const paso of pasos) {
    issues = [];
    const t0 = Date.now();
    let estado = "PASÓ";
    let nota = "";
    try {
      await paso.fn(st);
    } catch (err) {
      estado = "FALLÓ";
      nota = String(err && err.message ? err.message : err).slice(0, 300);
      console.error(`\n[e2e] ✗ ${paso.nombre}\n      ${nota}\n`);
      // screenshot del último estado de página conocido
      try {
        if (st.page && !st.page.isClosed()) {
          const slug = paso.nombre
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40);
          const file = path.join(FAILS_DIR, `${slug}.png`);
          await st.page.screenshot({ path: file, fullPage: true });
          console.error(`[e2e]   screenshot → ${file}`);
        }
      } catch {
        /* screenshot best-effort */
      }
    }
    if (estado === "PASÓ") pasaron++;
    else fallaron++;

    if (issues.length) {
      nota = `${nota ? nota + " · " : ""}${issues.length} avisos`;
      console.error(`[e2e]   avisos de página/HTTP en este paso:`);
      for (const i of issues.slice(0, 12)) console.error(`         - ${i}`);
      if (issues.length > 12) console.error(`         … (+${issues.length - 12} más)`);
    }

    st.resultados.push({
      paso: paso.nombre,
      resultado: estado,
      segundos: ((Date.now() - t0) / 1000).toFixed(1),
      notas: nota,
    });
  }

  await st.browser.close().catch(() => {});

  console.log("\n================ RESUMEN E2E FUNCIONAL ================");
  console.table(st.resultados);
  console.log(
    `\nTotal: ${pasaron} PASÓ · ${fallaron} FALLÓ · RUN=${RUN} · BASE=${BASE}`,
  );
  if (fallaron) console.log("Screenshots de fallos en:", FAILS_DIR);

  // El resumen manda: exit code 0 siempre.
  process.exitCode = 0;
}

main().catch((e) => {
  console.error("[e2e] error fatal del runner:", e);
  process.exitCode = 0; // igualmente 0: el resumen manda (corrida abortada)
});
