import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, labOrders } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS = ["enviado", "fabricacion", "recibido", "colocado", "cancelado"] as const;
type Estado = (typeof ESTADOS)[number];

const TRANSICION: Record<Exclude<Estado, "cancelado">, Estado | null> = {
  enviado: "fabricacion",
  fabricacion: "recibido",
  recibido: "colocado",
  colocado: null,
};

const ATRAS: Record<Exclude<Estado, "cancelado">, Estado | null> = {
  enviado: null,
  fabricacion: "enviado",
  recibido: "fabricacion",
  colocado: "recibido",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { estado?: string; motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const estado = body.estado as Estado | undefined;
  if (!estado || !ESTADOS.includes(estado)) {
    return NextResponse.json({ error: "estado_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [actual] = await db
    .select({ id: labOrders.id, estado: labOrders.estado, rev: labOrders.rev })
    .from(labOrders)
    .where(and(eq(labOrders.id, id), eq(labOrders.tenantId, g.team.id)))
    .limit(1);
  if (!actual) {
    return NextResponse.json({ error: "pedido_no_encontrado" }, { status: 404 });
  }

  const actualEstado = actual.estado as Estado;
  const esRetroceso =
    actualEstado !== "cancelado" &&
    ATRAS[actualEstado as Exclude<Estado, "cancelado">] === estado;
  if (esRetroceso && (!body.motivo || body.motivo.trim().length < 3)) {
    return NextResponse.json({ error: "motivo_requerido_para_retroceder" }, { status: 400 });
  }
  const permitido =
    estado === "cancelado"
      ? true
      : esRetroceso || (actualEstado !== "cancelado" && TRANSICION[actualEstado] === estado);
  if (actualEstado === estado || !permitido) {
    return NextResponse.json({ error: "transicion_invalida" }, { status: 400 });
  }

  const [row] = await db
    .update(labOrders)
    .set({
      estado,
      motivoRevision: esRetroceso ? body.motivo!.trim() : null,
      rev: esRetroceso ? actual.rev + 1 : actual.rev,
      updatedAt: new Date(),
    })
    .where(and(eq(labOrders.id, id), eq(labOrders.tenantId, g.team.id)))
    .returning({ id: labOrders.id, estado: labOrders.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: esRetroceso ? "laboratorio.retroceder" : "laboratorio.estado",
    entidad: "lab_orders",
    entidadId: id,
    payload: { de: actualEstado, a: estado, motivo: body.motivo?.trim() ?? null },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado });
}
