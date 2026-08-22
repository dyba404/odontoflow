import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, appointments } from "@odontoflow/db";
import { resolvePortalToken, resolvePortalPaciente, ensureMagicToken, magicUrl } from "@/lib/magic-link";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// P1 (Ola 5): desde el portal, el paciente obtiene el link de gestión
// (reprogramar/cancelar) de una cita concreta, reusando el wizard /gestionar.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:gestionar:${token}:${ipReq(req)}`, 6);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalToken(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  let body: { citaId?: string; pacienteId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  if (!body.citaId || typeof body.citaId !== "string") {
    return NextResponse.json({ error: "citaId_requerido" }, { status: 400 });
  }

  const pr = await resolvePortalPaciente(ctx, body.pacienteId ?? null);
  if (!pr.ok) return NextResponse.json({ error: pr.reason }, { status: pr.status });
  const paciente = pr.patient;

  const db = getDb();
  const [cita] = await db
    .select({ id: appointments.id, estado: appointments.estado })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, body.citaId),
        eq(appointments.patientId, paciente.id),
        eq(appointments.tenantId, ctx.team.id),
      ),
    )
    .limit(1);
  if (!cita) return NextResponse.json({ error: "cita_no_encontrada" }, { status: 404 });

  if (cita.estado !== "solicitada" && cita.estado !== "confirmada") {
    return NextResponse.json(
      { error: `no_se_puede_gestionar_en_${cita.estado}` },
      { status: 409 },
    );
  }

  const magicToken = await ensureMagicToken(ctx.team.id, paciente.id, cita.id);
  const url = magicUrl(ctx.team.slug, magicToken);

  void logAudit({
    tenantId: ctx.team.id,
    accion: "portal.link_gestionar",
    entidad: "citas",
    entidadId: cita.id,
    payload: { via: "token_portal" },
  });

  return NextResponse.json({ url });
}
