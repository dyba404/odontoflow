import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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
  const [quote] = await db
    .select({ id: quotes.id, linkLockedAt: quotes.linkLockedAt, linkFailCount: quotes.linkFailCount })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!quote) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  if (!quote.linkLockedAt) {
    return NextResponse.json({ error: "link_no_bloqueado" }, { status: 409 });
  }

  await db
    .update(quotes)
    .set({ linkLockedAt: null, linkFailCount: 0 })
    .where(eq(quotes.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.link_desbloqueado",
    entidad: "quotes",
    entidadId: id,
    payload: { fallosPrevios: quote.linkFailCount },
  });

  return NextResponse.json({ ok: true });
}
