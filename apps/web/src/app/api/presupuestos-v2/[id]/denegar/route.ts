import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, quotes } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MOTIVOS = ["precio", "tiempo", "segunda_opinion", "otro"] as const;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { motivo?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const motivo = body.motivo as (typeof MOTIVOS)[number];
  if (!MOTIVOS.includes(motivo)) {
    return NextResponse.json({ error: "motivo_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [quote] = await db
    .select({ id: quotes.id, estado: quotes.estado })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!quote) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  if (quote.estado === "aprobado" || quote.estado === "convertido") {
    return NextResponse.json({ error: "presupuesto_ya_aceptado" }, { status: 400 });
  }

  await db
    .update(quotes)
    .set({ estado: "rechazado", denegadoMotivo: motivo, updatedAt: new Date() })
    .where(eq(quotes.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.denegar",
    entidad: "quotes",
    entidadId: id,
    payload: { motivo },
  });

  return NextResponse.json({ ok: true, motivo });
}
