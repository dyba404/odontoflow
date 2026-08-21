import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS_SALA = ["anunciado", "en_box", "en_espera_pago", "atendido", "retirado"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("checkin.perform");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { salaEstado?: string | null; room?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.salaEstado === null) {
    set.salaEstado = null;
    set.room = null;
  } else if (typeof body.salaEstado === "string") {
    if (!ESTADOS_SALA.includes(body.salaEstado as (typeof ESTADOS_SALA)[number])) {
      return NextResponse.json({ error: "estado_sala_invalido" }, { status: 400 });
    }
    set.salaEstado = body.salaEstado;
    if (typeof body.room === "string" && body.room.trim()) {
      if (body.room.trim().length > 20) return NextResponse.json({ error: "consultorio_invalido" }, { status: 400 });
      set.room = body.room.trim();
    } else if (body.salaEstado === "en_box" && !body.room) {
      return NextResponse.json({ error: "consultorio_requerido" }, { status: 400 });
    }
  } else if (typeof body.room === "string" || body.room === null) {
    set.room = body.room?.trim() || null;
  } else {
    return NextResponse.json({ error: "nada_que_actualizar" }, { status: 400 });
  }

  const db = getDb();
  const [appt] = await db
    .select({ id: appointments.id, tenantId: appointments.tenantId, estado: appointments.estado })
    .from(appointments)
    .where(eq(appointments.id, id))
    .limit(1);
  if (!appt || appt.tenantId !== g.team.id) {
    return NextResponse.json({ error: "no_encontrada" }, { status: 404 });
  }

  await db.update(appointments).set(set).where(eq(appointments.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "cita.sala",
    entidad: "citas",
    entidadId: id,
    payload: { salaEstado: body.salaEstado ?? null, room: body.room ?? null },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("agenda.view_all");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [appt] = await getDb()
    .select({
      salaEstado: appointments.salaEstado,
      room: appointments.room,
      currentStatusSince: appointments.currentStatusSince,
    })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.tenantId, g.team.id)))
    .limit(1);
  if (!appt) return NextResponse.json({ error: "no_encontrada" }, { status: 404 });

  return NextResponse.json({
    salaEstado: appt.salaEstado,
    room: appt.room,
    currentStatusSince: appt.currentStatusSince?.toISOString() ?? null,
  });
}
