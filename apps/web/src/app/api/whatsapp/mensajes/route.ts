import { NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, whatsappMessages, patients } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { enviarMensajeManual } from "@/lib/whatsapp-entrante";
import { rateLimit, ipReq } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "recordatorios");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 50, 1), 200);
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  const direccion = url.searchParams.get("direccion");

  const condiciones = [eq(whatsappMessages.tenantId, g.team.id)];
  if (direccion === "in" || direccion === "out") {
    condiciones.push(eq(whatsappMessages.direction, direccion));
  }

  const db = getDb();
  const [filas, [totalRow]] = await Promise.all([
    db
      .select({
        id: whatsappMessages.id,
        waId: whatsappMessages.waId,
        direction: whatsappMessages.direction,
        patientId: whatsappMessages.patientId,
        patientNombre: patients.nombre,
        phoneNumber: whatsappMessages.phoneNumber,
        body: whatsappMessages.body,
        estado: whatsappMessages.estado,
        error: whatsappMessages.error,
        createdAt: whatsappMessages.createdAt,
      })
      .from(whatsappMessages)
      .leftJoin(patients, eq(whatsappMessages.patientId, patients.id))
      .where(and(...condiciones))
      .orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(whatsappMessages).where(and(...condiciones)),
  ]);

  const total = totalRow?.total ?? 0;

  return NextResponse.json({
    mensajes: filas,
    total,
    limit,
    offset,
    siguienteOffset: offset + limit < total ? offset + limit : null,
  });
}

// P4 (Ola 5): el staff responde manualmente a un paciente desde la bandeja.
export async function POST(req: Request) {
  const g = await guardStaff("patients.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "recordatorios");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const limite = rateLimit(`wa-manual:${g.team.id}:${ipReq(req)}`, 20);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  let body: { waId?: string; patientId?: string | null; texto?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const waId = typeof body.waId === "string" ? body.waId.trim() : "";
  if (!waId || waId.length > 32) {
    return NextResponse.json({ error: "waId_invalido" }, { status: 400 });
  }
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (!texto || texto.length > 1000) {
    return NextResponse.json({ error: "texto_invalido" }, { status: 400 });
  }

  let patientId: string | null = null;
  if (typeof body.patientId === "string" && body.patientId) {
    const db = getDb();
    const [p] = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
      .limit(1);
    if (!p) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
    patientId = p.id;
  }

  const r = await enviarMensajeManual({
    tenantId: g.team.id,
    patientId,
    waId,
    body: texto,
    enviadoPor: g.user.id,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error ?? "error_whatsapp" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
