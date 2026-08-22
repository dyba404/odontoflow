import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, patients } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { obtenerOCrearCodigoReferido, linkReferido } from "@/lib/referidos";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const filas = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (filas.length === 0) {
    return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
  }

  const codigo = await obtenerOCrearCodigoReferido(g.team.id, id);
  return NextResponse.json({ ok: true, codigo, url: linkReferido(g.team.slug, codigo) });
}
