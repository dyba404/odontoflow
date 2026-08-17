import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, labOrders, patients } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("records.view");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: labOrders.id,
      tipo: labOrders.tipo,
      laboratorio: labOrders.laboratorio,
      fechaPromesa: labOrders.fechaPromesa,
      costo: labOrders.costo,
      estado: labOrders.estado,
      notas: labOrders.notas,
      createdAt: labOrders.createdAt,
    })
    .from(labOrders)
    .where(and(eq(labOrders.patientId, id), eq(labOrders.tenantId, g.team.id)))
    .orderBy(desc(labOrders.createdAt));

  return NextResponse.json({ pedidos: rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("labs.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    tipo?: string;
    laboratorio?: string;
    fechaPromesa?: string;
    costo?: number | string;
    notas?: string;
    appointmentId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tipo = body.tipo?.trim() ?? "";
  if (!tipo || tipo.length > 60) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }

  const laboratorio = body.laboratorio?.trim() ?? "";
  if (laboratorio.length > 120) {
    return NextResponse.json({ error: "laboratorio_invalido" }, { status: 400 });
  }

  let fechaPromesa: string | null = null;
  if (body.fechaPromesa) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fechaPromesa) || Number.isNaN(new Date(`${body.fechaPromesa}T12:00:00`).getTime())) {
      return NextResponse.json({ error: "fecha_invalida" }, { status: 400 });
    }
    fechaPromesa = body.fechaPromesa;
  }

  let costo = 0;
  if (typeof body.costo !== "undefined") {
    costo = Number(body.costo);
    if (!Number.isFinite(costo) || costo < 0) {
      return NextResponse.json({ error: "costo_invalido" }, { status: 400 });
    }
  }

  const notas = body.notas?.trim() ?? "";
  if (notas.length > 500) {
    return NextResponse.json({ error: "notas_invalida" }, { status: 400 });
  }

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const [row] = await db
    .insert(labOrders)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      appointmentId:
        typeof body.appointmentId === "string" && body.appointmentId ? body.appointmentId : null,
      tipo,
      laboratorio: laboratorio || null,
      fechaPromesa,
      costo: String(costo),
      notas: notas || null,
      createdBy: g.user.id,
    })
    .returning({ id: labOrders.id, estado: labOrders.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "laboratorio.crear",
    entidad: "lab_orders",
    entidadId: row!.id,
    payload: { tipo, laboratorio: laboratorio || null, costo },
  });

  return NextResponse.json({ ok: true, id: row!.id, estado: row!.estado }, { status: 201 });
}
