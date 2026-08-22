import { EventEmitter } from "node:events";

export type EventoTipo = "cita" | "sala" | "bloqueo" | "solicitud";

export interface EventoConsola {
  teamId: string;
  tipo: EventoTipo;
}

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publishEvento(teamId: string, tipo: EventoTipo): void {
  bus.emit("evento", { teamId, tipo } satisfies EventoConsola);
}

export function suscribirEventos(
  handler: (ev: EventoConsola) => void,
): () => void {
  bus.on("evento", handler);
  return () => {
    bus.off("evento", handler);
  };
}
