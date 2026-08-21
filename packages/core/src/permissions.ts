import type { StaffRole } from "./types.js";

export type Permission =
  | "agenda.view_all"
  | "agenda.view_own"
  | "appointments.create"
  | "appointments.edit"
  | "appointments.cancel_own"
  | "checkin.perform"
  | "patients.manage"
  | "records.view"
  | "records.edit"
  | "records.edit_partial"
  | "payments.register"
  | "reports.view_all"
  | "reports.view_daily"
  | "reminders.send"
  | "staff.manage"
  | "services.manage"
  | "receipts.issue"
  | "inventory.manage"
  | "quotes.manage"
  | "labs.manage"
  | "commissions.manage"
  | "insurers.manage"
  | "waitlist.manage"
  | "campaigns.manage"
  | "vat.manage"
  | "branches.manage"
  | "arco.manage";

const ALL: Record<StaffRole, ReadonlyArray<Permission>> = {
  owner: [
    "agenda.view_all",
    "agenda.view_own",
    "appointments.create",
    "appointments.edit",
    "appointments.cancel_own",
    "checkin.perform",
    "patients.manage",
    "records.view",
    "records.edit",
    "records.edit_partial",
    "payments.register",
    "reports.view_all",
    "reports.view_daily",
    "reminders.send",
    "staff.manage",
    "services.manage",
    "receipts.issue",
    "inventory.manage",
    "quotes.manage",
    "labs.manage",
    "commissions.manage",
    "insurers.manage",
    "waitlist.manage",
    "campaigns.manage",
    "vat.manage",
    "branches.manage",
    "arco.manage",
  ],
  receptionist: [
    "agenda.view_all",
    "appointments.create",
    "appointments.edit",
    "checkin.perform",
    "patients.manage",
    "records.view",
    "payments.register",
    "reports.view_daily",
    "reminders.send",
    "receipts.issue",
    "quotes.manage",
    "insurers.manage",
    "waitlist.manage",
    "campaigns.manage",
  ],
  assistant: [
    "agenda.view_all",
    "checkin.perform",
    "patients.manage",
    "records.edit_partial",
    "inventory.manage",
    "labs.manage",
  ],
  doctor: [
    "agenda.view_own",
    "appointments.create",
    "appointments.cancel_own",
    "records.view",
    "records.edit",
    "patients.manage",
    "quotes.manage",
    "labs.manage",
  ],
};

export function permissionsFor(role: StaffRole): ReadonlyArray<Permission> {
  return ALL[role];
}

/**
 * RBAC v2: matching con wildcards. Un grant puede ser:
 *  · `"*"`                        → todo
 *  · `"modulo.*"`                  → prefijo con punto (`agenda.*` cubre `agenda.view_all`)
 *  · `"modulo.recurso.accion"`      → string exacto
 * `requested` siempre es un string concreto. Sin coincidencia → false.
 */
export function matchPermission(granted: string, requested: string): boolean {
  if (granted === "*") return true;
  if (granted === requested) return true;
  if (granted.endsWith(".*")) {
    const prefijo = granted.slice(0, -2); // sin el ".*"
    return requested.startsWith(`${prefijo}.`);
  }
  return false;
}

/** Lista plana de permisos de un rol (para el frontend). */
export function expandPermissions(role: StaffRole): ReadonlyArray<string> {
  return permissionsFor(role) as ReadonlyArray<string>;
}

/** Chequeo por string con soporte de wildcards (RBAC v2). */
export function can(role: StaffRole, permission: string): boolean {
  for (const g of permissionsFor(role) as ReadonlyArray<string>) {
    if (matchPermission(g, permission)) return true;
  }
  return false;
}

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return can(role, permission);
}

export interface AccessContext {
  tenantId: string;
  role: StaffRole;
  membershipId: string;
  insideShift: boolean;
}

export function canAccess(ctx: AccessContext, restrictionOut: boolean): boolean {
  if (!ctx.role) return false;
  if (restrictionOut && !ctx.insideShift) return false;
  return true;
}
