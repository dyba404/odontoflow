import { cache } from "react";
import { NextResponse } from "next/server";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { getDb, appointments, memberships, patients, subscriptions } from "@odontoflow/db";

export type PlanCode = "free" | "pro" | "premium";

export type PlanFeature =
  | "ficha_avanzada"
  | "recordatorios"
  | "caja"
  | "dashboard"
  | "facturacion"
  | "export_sunat"
  | "inventario"
  | "presupuestos"
  | "comisiones";

const ORDEN_PLAN: Record<PlanCode, number> = { free: 0, pro: 1, premium: 2 };

export const FEATURE_PLAN: Record<PlanFeature, PlanCode> = {
  ficha_avanzada: "pro",
  recordatorios: "pro",
  dashboard: "pro",
  caja: "premium",
  facturacion: "premium",
  export_sunat: "premium",
  inventario: "premium",
  presupuestos: "premium",
  comisiones: "premium",
};

export const FEATURE_TITULO: Record<PlanFeature, string> = {
  ficha_avanzada: "Ficha clínica avanzada",
  recordatorios: "Recordatorios",
  dashboard: "Dashboard de ingresos",
  caja: "Caja del día",
  facturacion: "Facturación electrónica",
  export_sunat: "Exportación SUNAT",
  inventario: "Inventario y márgenes",
  presupuestos: "Presupuestos y cuotas",
  comisiones: "Comisiones por doctor",
};

export const PLAN_NOMBRE: Record<PlanCode, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
};

export function planSuficiente(actual: PlanCode, requerido: PlanCode): boolean {
  return ORDEN_PLAN[actual] >= ORDEN_PLAN[requerido];
}

async function planDeTenantRaw(tenantId: string): Promise<PlanCode> {
  const [sub] = await getDb()
    .select({ plan: subscriptions.plan, estado: subscriptions.estado })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  if (!sub) return "free";
  if (sub.estado === "suspendido" || sub.estado === "cancelado") return "free";
  return sub.plan;
}

export const planDeTenant = cache(planDeTenantRaw);

export async function planDeTenantSinCache(tenantId: string): Promise<PlanCode> {
  return planDeTenantRaw(tenantId);
}

export function planEsProOMayor(plan: PlanCode): boolean {
  return ORDEN_PLAN[plan] >= ORDEN_PLAN["pro"];
}

export type GateOk = { ok: true };
export type GateBloqueo = { ok: false; requerido: PlanCode; planActual: PlanCode };
export type GateResultado = GateOk | GateBloqueo;

export async function gatePlan(
  tenantId: string,
  feature: PlanFeature,
): Promise<GateResultado> {
  const requerido = FEATURE_PLAN[feature];
  const actual = await planDeTenant(tenantId);
  if (planSuficiente(actual, requerido)) return { ok: true };
  return { ok: false, requerido, planActual: actual };
}

export function respuestaPlanInsuficiente(bloqueo: GateBloqueo) {
  return NextResponse.json(
    {
      error: "plan_insuficiente",
      requerido: PLAN_NOMBRE[bloqueo.requerido],
      plan_actual: PLAN_NOMBRE[bloqueo.planActual],
    },
    { status: 402 },
  );
}

export interface PlanLimits {
  maxMembers: number | null;
  maxPatients: number | null;
  maxCitasMes: number | null;
}

export const PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  free: { maxMembers: 2, maxPatients: 200, maxCitasMes: 100 },
  pro: { maxMembers: null, maxPatients: null, maxCitasMes: null },
  premium: { maxMembers: null, maxPatients: null, maxCitasMes: null },
};

export type LimitKind = "members" | "patients" | "citas_mes";

export interface LimitReached {
  limite: number;
  actual: number;
  plan: PlanCode;
}

function firstCount(rows: Array<{ n: number }>): number {
  return rows[0]?.n ?? 0;
}

async function countMembers(tenantId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(memberships)
    .where(and(eq(memberships.teamId, tenantId), eq(memberships.active, true)))
    .limit(1);
  return firstCount(rows);
}

async function countPatients(tenantId: string): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(patients)
    .where(eq(patients.tenantId, tenantId))
    .limit(1);
  return firstCount(rows);
}

async function countCitasMes(tenantId: string, mes: string): Promise<number> {
  const base = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!base) return 0;
  const inicio = `${base[1]}-${base[2]}-01`;
  const anio = Number(base[1]);
  const numMes = Number(base[2]);
  const fin =
    numMes === 12
      ? `${anio + 1}-01-01`
      : `${anio}-${String(numMes + 1).padStart(2, "0")}-01`;
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.fecha, inicio),
        lt(appointments.fecha, fin),
        ne(appointments.estado, "cancelada"),
      ),
    )
    .limit(1);
  return firstCount(rows);
}

// Devuelve null si hay cupo; en free retorna el tope alcanzado. pro/premium
// no tienen limite (null en PLAN_LIMITS). mes aplica solo a "citas_mes".
export async function limitePlanAlcanzado(
  tenantId: string,
  kind: LimitKind,
  mes?: string,
): Promise<LimitReached | null> {
  const plan = await planDeTenant(tenantId);
  const limites = PLAN_LIMITS[plan];
  if (kind === "members") {
    if (limites.maxMembers === null) return null;
    const actual = await countMembers(tenantId);
    return actual >= limites.maxMembers ? { limite: limites.maxMembers, actual, plan } : null;
  }
  if (kind === "patients") {
    if (limites.maxPatients === null) return null;
    const actual = await countPatients(tenantId);
    return actual >= limites.maxPatients ? { limite: limites.maxPatients, actual, plan } : null;
  }
  if (limites.maxCitasMes === null) return null;
  const actual = await countCitasMes(tenantId, (mes ?? "").slice(0, 7));
  return actual >= limites.maxCitasMes ? { limite: limites.maxCitasMes, actual, plan } : null;
}

export function respuestaLimitePlan(kind: LimitKind, r: LimitReached): NextResponse {
  return NextResponse.json(
    {
      error: "limite_plan_alcanzado",
      recurso: kind,
      limite: r.limite,
      actual: r.actual,
      plan_actual: PLAN_NOMBRE[r.plan],
    },
    { status: 402 },
  );
}

export interface UsoPlan {
  plan: PlanCode;
  limites: PlanLimits;
  miembros: number;
  pacientes: number;
  citasMes: number;
}

export async function usoPlan(tenantId: string, mes: string): Promise<UsoPlan> {
  const [plan, miembros, pacientes, citasMes] = await Promise.all([
    planDeTenant(tenantId),
    countMembers(tenantId),
    countPatients(tenantId),
    countCitasMes(tenantId, mes.slice(0, 7)),
  ]);
  return { plan, limites: PLAN_LIMITS[plan], miembros, pacientes, citasMes };
}
