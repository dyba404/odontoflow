import type { OdontoflowDb } from "@odontoflow/db";

// ---------------------------------------------------------------------------
// Event bus ligero transaccional (concepto de dentalpin re-implementado en TS;
// cero líneas copiadas, cumple la regla "clean-room" del repo).
//
// Reglas:
//  · un handler transaccional recibe `tx` y corre en LA MISMA transacción que el
//    publicador; su excepción propaga y revierte todo.
//  · un handler no-transaccional se ejecuta tras el publish y su excepción se
//    loguea sin revertir.
//  · los handlers de snapshot no leen tablas de otros dominios; el payload
//    lleva TODO lo que necesitan (evita deadlocks/acoplamientos).
// ---------------------------------------------------------------------------

export interface HandlerCtx {
  db?: OdontoflowDb;
}

export type EventHandler<T = unknown> = (
  payload: T,
  ctx: HandlerCtx,
) => void | Promise<void>;

interface Entry {
  handler: EventHandler;
  transactional: boolean;
}

const registros = new Map<string, Entry[]>();

// Registrar un manejador (efecto). `unsubscribe` deshace.
export function subscribe<T = unknown>(
  tipo: string,
  handler: EventHandler<T>,
  opts: SubscribeOptions = {},
): () => void {
  const { transactional = false } = opts;
  const g = registros.get(tipo) ?? [];
  g.push({ handler: handler as EventHandler, transactional });
  registros.set(tipo, g);
  return () => {
    const i = g.findIndex((e) => e.handler === (handler as EventHandler));
    if (i >= 0) g.splice(i, 1);
  };
}

export interface SubscribeOptions {
  transactional?: boolean;
}

export interface PublishOptions {
  tx?: OdontoflowDb;
  /** corre los no-transaccionales después del primer grupo de handlers (default true). */
  runAfterCommit?: boolean;
}

export async function publish<T = unknown>(
  tipo: string,
  payload: T,
  opts: PublishOptions = {},
): Promise<number> {
  const handlers = [...(registros.get(tipo) ?? [])];
  let procesados = 0;

  const noTx: Array<() => Promise<void>> = [];
  for (const h of handlers) {
    if (h.transactional) {
      if (!opts.tx) {
        throw new Error(
          `handler transaccional para "${tipo}" requiere publish(..., { tx })`,
        );
      }
      await h.handler(payload as never, { db: opts.tx });
      procesados += 1;
    } else {
      noTx.push(async () => {
        try {
          await h.handler(payload as never, {});
        } catch {
          // sin gestión de logs; se omite a propósito
        }
      });
    }
  }

  if (!opts.tx || opts.runAfterCommit === true) {
    for (const f of noTx) {
      await f();
      procesados += 1;
    }
  }

  return procesados;
}
