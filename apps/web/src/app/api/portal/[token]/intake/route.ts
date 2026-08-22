import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, patients } from "@odontoflow/db";
import { resolvePortalToken, resolvePortalPaciente } from "@/lib/magic-link";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, MAX_LEN) : null;
}

// P3 (Ola 5): intake digital pre-cita. El paciente completa/actualiza su
// historia clínica básica (alergias, antecedentes, medicación, gestación)
// desde el portal, antes de su cita.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:intake:${token}:${ipReq(req)}`, 10);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalToken(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;

  let body: {
    alergias?: string | null;
    antecedentes?: string | null;
    medicacion?: string | null;
    gestacion?: boolean;
    pacienteId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const pr = await resolvePortalPaciente(ctx, body.pacienteId ?? null);
  if (!pr.ok) return NextResponse.json({ error: pr.reason }, { status: pr.status });
  const paciente = pr.patient;

  const updates: {
    alergias?: string | null;
    antecedentes?: string | null;
    medicacion?: string | null;
    gestacion?: boolean;
  } = {};

  if (body.alergias !== undefined) updates.alergias = clean(body.alergias);
  if (body.antecedentes !== undefined) updates.antecedentes = clean(body.antecedentes);
  if (body.medicacion !== undefined) updates.medicacion = clean(body.medicacion);
  if (body.gestacion !== undefined) {
    if (typeof body.gestacion !== "boolean") {
      return NextResponse.json({ error: "gestacion_invalido" }, { status: 400 });
    }
    updates.gestacion = body.gestacion;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "sin_cambios" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(patients)
    .set(updates)
    .where(eq(patients.id, paciente.id));

  void logAudit({
    tenantId: ctx.team.id,
    accion: "portal.intake_actualizado",
    entidad: "patients",
    entidadId: paciente.id,
    payload: {
      campos: Object.keys(updates),
      via: "token_portal",
      ...(paciente.id !== ctx.patient.id ? { representanteId: ctx.patient.id } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
