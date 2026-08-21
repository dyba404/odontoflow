// Semántica wall-clock (punto 4 de §2.2).
//
// Regla: los datetimes "pelados" que entran a la app representan la hora
// del reloj de la pared de la clínica, no UTC. Para convertir correctamente
// se usan helpers con TZ de la clínica, NUNCA `new Date(iso).getHours()`
// (bug móvil de dentalpin). El frontend usa estos helpers.
//
import { nowLocalPartsIn } from "./slots.js";

export const DEFAULT_TIMEZONE = "America/Lima";

export type Timezone = string;

/**
 * Convierte una fecha a "wall-clock" (string YYYY-MM-DD) en la TZ de la
 * clínica. `nowLocalPartsIn` de slots.ts es el fuente de min/hora; este helper
 * cubre la fecha/hora de pared restante.
 */
export function fechaEn(instante: Date, timezone: Timezone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** Instante actual (idéntico a `new Date()`; alias para legibilidad del dominio). */
export function clinicNow(_timezone?: Timezone): Date {
  return new Date();
}

/**
 * Interpreta un datetime "naive" de pared como un instante real. El input
 * `YYYY-MM-DD` se deja como fecha local (media noche estándar); `YYYY-MM-DD HH:mm`
 * o ISO completos pasan directo a `new Date`. La TZ real se obtiene con
 * `fechaEn`/`nowLocalPartsIn` de slots.ts; jamás `getHours()` crudo.
 */
export function parseWallClock(input: string | Date): Date {
  if (input instanceof Date) return input;
  const iso = input.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00`);
  return new Date(iso);
}

/** Hora "de pared" (HH:mm) actual en la TZ de la clínica. */
export function horaParedEn(now: Date, timezone: Timezone = DEFAULT_TIMEZONE): string {
  const min = nowLocalPartsIn(now, timezone).min;
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}
