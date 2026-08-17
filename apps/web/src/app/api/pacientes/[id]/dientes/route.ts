import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients, toothStates } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Estado = (typeof toothStates.$inferSelect)["estado"];

const ESTADOS: readonly Estado[] = ["sano", "cariado", "tratado", "extraido", "corona", "ausente"];

function esEstado(v: unknown): v is Estado {
  return typeof v === "string" && (ESTADOS as readonly string[]).includes(v);
}

function fdiValido(fdi: number): boolean {
  return (
    (fdi >= 11 && fdi <= 18) ||
    (fdi >= 21 && fdi <= 28) ||
    (fdi >= 31 && fdi <= 38) ||
    (fdi >= 41 && fdi <= 48)
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { toothFdi?: number; estado?: string; nota?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const toothFdi = Number(body.toothFdi);
  if (!Number.isInteger(toothFdi) || !fdiValido(toothFdi)) {
    return NextResponse.json({ error: "diente_invalido" }, { status: 400 });
  }
  const estado = body.estado;
  if (!esEstado(estado)) {
    return NextResponse.json({ error: "estado_desconocido" }, { status: 400 });
  }

  const g = await guardStaff("records.edit");
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

  const nota = body.nota?.trim() || null;
  const [row] = await db
    .insert(toothStates)
    .values({
      patientId: paciente.id,
      toothFdi,
      estado,
      nota,
      updatedBy: g.user.id,
    })
    .onConflictDoUpdate({
      target: [toothStates.patientId, toothStates.toothFdi],
      set: { estado, nota, updatedBy: g.user.id, updatedAt: new Date() },
    })
    .returning({
      id: toothStates.id,
      toothFdi: toothStates.toothFdi,
      estado: toothStates.estado,
      nota: toothStates.nota,
      updatedAt: toothStates.updatedAt,
    });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "odontograma.actualizar",
    entidad: "patients",
    entidadId: paciente.id,
    payload: { toothFdi, estado: row!.estado },
  });

  return NextResponse.json({
    ok: true,
    id: row!.id,
    toothFdi: row!.toothFdi,
    estado: row!.estado,
    nota: row!.nota,
    updatedAt: new Date(row!.updatedAt).toISOString(),
  });
}
