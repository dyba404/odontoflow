import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDb, patients, odontogramCharts, odontogramHistory } from "@odontoflow/db";
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
  const [chart] = await db
    .select({
      id: odontogramCharts.id,
      status: odontogramCharts.status,
      plan: odontogramCharts.plan,
      version: odontogramCharts.version,
      updatedAt: odontogramCharts.updatedAt,
    })
    .from(odontogramCharts)
    .where(and(eq(odontogramCharts.tenantId, g.team.id), eq(odontogramCharts.patientId, id)))
    .limit(1);

  const [historia] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(odontogramHistory)
    .where(and(eq(odontogramHistory.tenantId, g.team.id), eq(odontogramHistory.patientId, id)));

  return NextResponse.json({
    chart: chart
      ? { id: chart.id, status: chart.status, plan: chart.plan, version: chart.version, updatedAt: chart.updatedAt.toISOString() }
      : null,
    versiones: Number(historia?.n ?? 0),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { status?: unknown; plan?: unknown; version?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });

  const status = body.status ?? null;
  const plan = body.plan ?? null;
  const version = typeof body.version === "string" ? body.version : null;

  const [antes] = await db
    .select({ id: odontogramCharts.id, status: odontogramCharts.status, plan: odontogramCharts.plan })
    .from(odontogramCharts)
    .where(and(eq(odontogramCharts.tenantId, g.team.id), eq(odontogramCharts.patientId, id)))
    .limit(1);

  const [chart] = await db
    .insert(odontogramCharts)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      status,
      plan,
      version,
      updatedBy: g.user.id,
    })
    .onConflictDoUpdate({
      target: [odontogramCharts.tenantId, odontogramCharts.patientId],
      set: { status, plan, version, updatedBy: g.user.id, updatedAt: new Date() },
    })
    .returning({ id: odontogramCharts.id });

  const chartId = chart?.id ?? null;

  if (antes && JSON.stringify(antes.status) !== JSON.stringify(status)) {
    await db.insert(odontogramHistory).values({
      tenantId: g.team.id,
      patientId: paciente.id,
      chartId,
      before: antes.status ?? null,
      after: status ?? null,
      changedBy: g.user.id,
    });
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "odontograma_v2.guardar",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { version },
  });

  return NextResponse.json({ ok: true, chartId });
}
