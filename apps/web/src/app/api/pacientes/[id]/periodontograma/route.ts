import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, patients, perioRecords, odontogramCharts } from "@odontoflow/db";
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
  const registros = await db
    .select({
      id: perioRecords.id,
      snapshot: perioRecords.snapshot,
      nota: perioRecords.nota,
      savedBy: perioRecords.savedBy,
      createdAt: perioRecords.createdAt,
    })
    .from(perioRecords)
    .where(and(eq(perioRecords.tenantId, g.team.id), eq(perioRecords.patientId, id)))
    .orderBy(desc(perioRecords.createdAt));

  return NextResponse.json({
    registros: registros.map((r) => ({
      id: r.id,
      snapshot: r.snapshot,
      nota: r.nota,
      creadoEl: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { snapshot?: unknown; nota?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.snapshot || typeof body.snapshot !== "object") {
    return NextResponse.json({ error: "snapshot_requerido" }, { status: 400 });
  }
  const nota = typeof body.nota === "string" && body.nota.trim() ? body.nota.trim().slice(0, 2000) : null;

  const g = await guardStaff("records.edit");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });

  const [chart] = await db
    .select({ id: odontogramCharts.id })
    .from(odontogramCharts)
    .where(and(eq(odontogramCharts.tenantId, g.team.id), eq(odontogramCharts.patientId, id)))
    .limit(1);

  const [registro] = await db
    .insert(perioRecords)
    .values({
      tenantId: g.team.id,
      patientId: paciente.id,
      chartId: chart?.id ?? null,
      snapshot: body.snapshot,
      nota,
      savedBy: g.user.id,
    })
    .returning({ id: perioRecords.id });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "periodontograma.snapshot",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { snapshotId: registro?.id ?? null, nota },
  });

  return NextResponse.json({ ok: true, id: registro?.id ?? null }, { status: 201 });
}
