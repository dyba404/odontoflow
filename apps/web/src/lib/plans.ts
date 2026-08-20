import { cache } from "react";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, subscriptions } from "@odontoflow/db";

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
