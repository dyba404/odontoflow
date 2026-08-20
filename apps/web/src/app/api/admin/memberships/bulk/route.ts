import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, teams, memberships } from "@odontoflow/db";
import { logAudit } from "@/lib/audit";
import { ipReq } from "@/lib/rate-limit";
import { adminGuard, auditPayloadSoporte } from "@/lib/admin-guard";

export async function POST(req: Request) {
  const guard = await adminGuard("membresias-bulk", ipReq(req));
  if (!guard.ok) return guard.response;

  let body: { tenantId?: string; active?: boolean; motivo?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const tenantId = body.tenantId?.trim();
  if (!tenantId) return NextResponse.json({ error: "tenant_requerido" }, { status: 400 });
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "active_requerido" }, { status: 400 });
  }
  const motivo = body.motivo?.trim() || null;
  if (!motivo) {
    return NextResponse.json({ error: "motivo_requerido" }, { status: 400 });
  }

  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, tenantId)).limit(1);
  if (!team) return NextResponse.json({ error: "tenant_no_encontrado" }, { status: 404 });

  const afectadas = await db
    .select({ id: memberships.id, userId: memberships.userId, active: memberships.active })
    .from(memberships)
    .where(and(eq(memberships.teamId, tenantId), eq(memberships.active, !body.active)));

  if (afectadas.length === 0) {
    return NextResponse.json({ ok: true, afectadas: 0 });
  }

  await db
    .update(memberships)
    .set({ active: body.active, updatedAt: new Date() })
    .where(
      and(
        eq(memberships.teamId, tenantId),
        eq(memberships.active, !body.active),
      ),
    );

  await logAudit({
    tenantId,
    usuarioId: guard.admin.userId,
    rol: null,
    accion: body.active ? "soporte.membresias_activadas_bulk" : "soporte.membresias_desactivadas_bulk",
    entidad: "memberships",
    entidadId: tenantId,
    payload: auditPayloadSoporte(guard.admin.email, {
      afectadas: afectadas.length,
      motivo,
      usuarios: afectadas.map((m) => m.userId),
    }),
  });

  return NextResponse.json({ ok: true, afectadas: afectadas.length });
}
