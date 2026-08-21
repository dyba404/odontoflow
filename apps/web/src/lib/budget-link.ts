import { createHash, createHmac, scryptSync, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Link público de presupuesto con verificación 2FA (visión §2.2(5)).
// Orden de rechazo: locked → expired → método distinto → rate-limit → comparar.
// Privacidad: IP siempre hasheada (SHA-256), nunca cruda.
// Cookie HttpOnly con path acotado al token y secreto independiente del global.
// ---------------------------------------------------------------------------

export const MAX_FALLOS_VENTANA = 5;
export const VENTANA_MS = 15 * 60 * 1000;
export const MAX_FALLOS_ACUMULADOS = 10;

/** SHA-256 hex de la IP (privacidad: nunca guardar la IP cruda). */
export function hashIp(ip: string | null | undefined): string {
  return createHash("sha256").update(ip ?? "desconocido").digest("hex");
}

/** Normaliza el valor 2FA antes de hashear/comparar. */
export function normalizarValor2fa(modo: string, valor: string): string {
  const v = valor.trim().toLowerCase();
  return modo === "phone_last4" ? v.replace(/\D/g, "") : v;
}

export function hashValor2fa(modo: string, valor: string): string {
  return createHash("sha256").update(normalizarValor2fa(modo, valor)).digest("hex");
}

/** Comparación de tiempo constante para el hash del valor 2FA. */
export function compararHash2fa(esperado: string, recibido: string): boolean {
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recibido, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// --- Cookie firmada con path acotado al token ------------------------------

const COOKIE_TTL_SECONDS = 30 * 60;

function cookieSecret(): Buffer {
  // Secreto INDEPENDIENTE del global (distinto salt de derivación).
  const master = process.env.LOCAL_MASTER_KEY ?? "odontoflow-dev";
  return scryptSync(master, "odontoflow-budget-cookie-v1", 32);
}

export function nombreCookiePresupuesto(token: string): string {
  return `ofp2f-${token.slice(0, 16)}`;
}

export function firmarCookiePresupuesto(token: string): string {
  const mac = createHmac("sha256", cookieSecret()).update(token).digest("hex");
  return `${token}.${mac}`;
}

export function verificarCookiePresupuesto(token: string, valor: string | undefined): boolean {
  if (!valor) return false;
  const punto = valor.lastIndexOf(".");
  if (punto < 0) return false;
  const tok = valor.slice(0, punto);
  const mac = valor.slice(punto + 1);
  if (tok !== token) return false;
  const esperado = createHmac("sha256", cookieSecret()).update(token).digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(mac, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function opcionesCookiePresupuesto(token: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: `/api/publico/presupuesto/${token}`,
    maxAge: COOKIE_TTL_SECONDS,
  };
}
