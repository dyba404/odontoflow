import { NextResponse } from "next/server";
import { and, eq, or, sql, desc } from "drizzle-orm";
import { getDb, quotes } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [original] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!original) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  if (original.estado !== "rechazado") {
    return NextResponse.json({ error: "solo_rechazado_clonable" }, { status: 400 });
  }

  const rootId = original.parentBudgetId ?? original.id;

  const [raiz] = await db
    .select({ id: quotes.id, titulo: quotes.titulo })
    .from(quotes)
    .where(
      and(
        eq(quotes.tenantId, g.team.id),
        or(
          eq(quotes.id, rootId),
          eq(quotes.parentBudgetId, rootId),
        ),
      ),
    )
    .orderBy(desc(quotes.createdAt))
    .limit(1);
  const tituloRaiz = (raiz?.titulo ?? original.titulo).replace(/\s*\(v\d+\)\s*$/, "").trim();
  const vBase = tituloRaiz.match(/\(v(\d+)\)$/);
  const raizId = original.parentBudgetId ?? original.id;

  const [cantidad] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quotes)
    .where(
      and(
        eq(quotes.tenantId, g.team.id),
        or(eq(quotes.id, raizId), eq(quotes.parentBudgetId, raizId)),
      ),
    );

  const version = vBase ? Number(vBase[1]) + 1 : (cantidad?.n ?? 1);
  const [clon] = await db
    .insert(quotes)
    .values({
      tenantId: g.team.id,
      patientId: original.patientId,
      doctorId: original.doctorId,
      titulo: `${tituloRaiz} (v${version})`,
      items: original.items,
      total: original.total,
      estado: "borrador",
      expiraEn: original.expiraEn,
      nota: original.nota,
      parentBudgetId: raizId,
      createdBy: g.user.id,
    })
    .returning({ id: quotes.id, titulo: quotes.titulo, estado: quotes.estado });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.clonar",
    entidad: "quotes",
    entidadId: clon!.id,
    payload: { originalId: id, version },
  });

  return NextResponse.json({ ok: true, presupuesto: { ...clon, version } }, { status: 201 });
}
