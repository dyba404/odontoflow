import type { AppointmentStatus } from "./types.js";

const TRANSITIONS: Record<AppointmentStatus, ReadonlyArray<AppointmentStatus>> = {
  solicitada: ["confirmada", "cancelada"],
  confirmada: ["en_espera", "cancelada", "no_show"],
  en_espera: ["en_atencion", "cancelada", "no_show"],
  en_atencion: ["atendida"],
  atendida: [],
  no_show: [],
  cancelada: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AppointmentStatus, to: AppointmentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transición inválida de cita: ${from} -> ${to}`);
  }
}
