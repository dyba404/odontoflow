import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, payments, patients, quotes, paymentAllocations } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";
import { computePaidSummary, num2 } from "@/lib/allocations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const qs = new URL(req.url).searchParams;
  const paymentId = qs.get("paymentId");
  const patientId = qs.get("patient");

  const filtros = [eq(paymentAllocations.tenantId, g.team.id)];
  if (paymentId) filtros.push(eq(paymentAllocations.paymentId, paymentId));
  if (patientId) filtros.push(eq(paymentAllocations.patientId, patientId));

  const rows = await db
    .select({
      id: paymentAllocations.id,
      paymentId: paymentAllocations.paymentId,
      quoteId: paymentAllocations.quoteId,
      patientNombre: patients.nombre,
      tituloPresupuesto: quotes.titulo,
      monto: paymentAllocations.monto,
      kind: paymentAllocations.kind,
      concepto: paymentAllocations.concepto,
      createdAt: paymentAllocations.createdAt,
    })
    .from(paymentAllocations)
    .leftJoin(patients, eq(paymentAllocations.patientId, patients.id))
    .leftJoin(quotes, eq(paymentAllocations.quoteId, quotes.id))
    .where(and(...filtros))
    .orderBy(desc(paymentAllocations.createdAt))
    .limit(100);

  const resumen = paymentId ? await computePaidSummary(g.team.id, paymentId) : null;

  return NextResponse.json({
    allocations: rows.map((r) => ({ ...r, monto: num2(r.monto), createdAt: r.createdAt.toISOString() })),
    resumen,
  });
}

export async function POST(req: Request) {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: {
    paymentId?: string;
    quoteId?: string | null;
    patientId?: string;
    monto?: number | string;
    concepto?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  if (!body.paymentId || !body.patientId) {
    return NextResponse.json({ error: "pago_y_paciente_requeridos" }, { status: 400 });
  }
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ error: "monto_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [pago] = await db
    .select({ id: payments.id, estado: payments.estado })
    .from(payments)
    .where(and(eq(payments.id, body.paymentId), eq(payments.tenantId, g.team.id)))
    .limit(1);
  if (!pago) return NextResponse.json({ error: "pago_no_encontrado" }, { status: 404 });
  if (pago.estado === "anulado") return NextResponse.json({ error: "pago_anulado" }, { status: 400 });

  const [paciente] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, body.patientId), eq(patients.tenantId, g.team.id)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });

  let quoteId: string | null = null;
  if (body.quoteId) {
    const [q] = await db
      .select({ id: quotes.id })
      .from(quotes)
      .where(and(eq(quotes.id, body.quoteId), eq(quotes.tenantId, g.team.id)))
      .limit(1);
    if (!q) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
    quoteId = q.id;
  }

  const resumen = await computePaidSummary(g.team.id, pago.id);
  if (!resumen || monto > resumen.disponible + 1e-9) {
    return NextResponse.json(
      { error: "monto_excede_disponible", disponible: resumen?.disponible ?? 0 },
      { status: 400 },
    );
  }

  const [row] = await db
    .insert(paymentAllocations)
    .values({
      tenantId: g.team.id,
      paymentId: pago.id,
      patientId: paciente.id,
      quoteId,
      monto: monto.toFixed(2),
      kind: "allocation",
      concepto: body.concepto?.trim() || null,
      createdBy: g.user.id,
    })
    .returning({ id: paymentAllocations.id, monto: paymentAllocations.monto });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.allocation",
    entidad: "payment_allocations",
    entidadId: row!.id,
    payload: { paymentId: pago.id, quoteId, monto, patientId: paciente.id },
  });

  return NextResponse.json({ ok: true, allocation: { ...row, monto: num2(row!.monto) } }, { status: 201 });
}
