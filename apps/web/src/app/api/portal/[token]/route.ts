import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getDb,
  appointments,
  services,
  memberships,
  users,
  installments,
  payments,
  receipts,
  quotes,
  signedConsents,
  patients,
} from "@odontoflow/db";
import { resolvePortalToken } from "@/lib/magic-link";
import { rateLimit, ipReq } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ESTADOS_PROXIMOS = ["solicitada", "confirmada", "en_espera", "en_atencion"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const limite = rateLimit(`portal:${token}:${ipReq(req)}`, 20);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const r = await resolvePortalToken(token);
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 404 });
  const { ctx } = r;
  const db = getDb();

  // P5 (Ola 5): cuentas familiares/tutor. El dueño del token puede ver el
  // portal de pacientes que lo tienen como representante (hijos, padres…).
  const url = new URL(req.url);
  const pacienteIdParam = url.searchParams.get("pacienteId");

  const representados = await db
    .select({ id: patients.id, nombre: patients.nombre })
    .from(patients)
    .where(
      and(
        eq(patients.representanteId, ctx.patient.id),
        eq(patients.tenantId, ctx.team.id),
        eq(patients.activo, true),
      ),
    )
    .orderBy(patients.nombre);

  let paciente = ctx.patient;
  if (pacienteIdParam && pacienteIdParam !== ctx.patient.id) {
    const match = representados.find((p) => p.id === pacienteIdParam);
    if (!match) {
      return NextResponse.json({ error: "paciente_no_permitido" }, { status: 403 });
    }
    const [fila] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, match.id))
      .limit(1);
    if (!fila) return NextResponse.json({ error: "paciente_no_encontrado" }, { status: 404 });
    paciente = fila;
  }

  const citas = await db
    .select({
      id: appointments.id,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      horaFin: appointments.horaFin,
      estado: appointments.estado,
      servicio: services.nombre,
      instruccionesPre: services.instruccionesPre,
      instruccionesPost: services.instruccionesPost,
      doctorNombre: users.name,
    })
    .from(appointments)
    .leftJoin(services, eq(appointments.serviceId, services.id))
    .leftJoin(memberships, eq(appointments.doctorId, memberships.id))
    .leftJoin(users, eq(memberships.userId, users.id))
    .where(eq(appointments.patientId, paciente.id))
    .orderBy(appointments.fecha, appointments.horaIni);

  const proximas = citas
    .filter((c) => (ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      horaFin: c.horaFin,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
      puedeConfirmar: c.estado === "solicitada",
      instruccionesPre: c.instruccionesPre,
      instruccionesPost: c.instruccionesPost,
    }));

  const historial = citas
    .filter((c) => !(ESTADOS_PROXIMOS as readonly string[]).includes(c.estado))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      horaIni: c.horaIni,
      estado: c.estado,
      servicio: c.servicio,
      doctor: c.doctorNombre,
    }))
    .sort((a, b) => (a.fecha === b.fecha ? (a.horaIni < b.horaIni ? 1 : -1) : a.fecha < b.fecha ? 1 : -1))
    .slice(0, 20);

  const cuotas = await db
    .select({
      id: installments.id,
      concepto: installments.concepto,
      n: installments.n,
      monto: installments.monto,
      pagado: installments.pagado,
      vence: installments.vence,
      estado: installments.estado,
    })
    .from(installments)
    .where(
      and(eq(installments.patientId, paciente.id), eq(installments.tenantId, ctx.team.id)),
    )
    .orderBy(installments.vence, installments.n);

  const cuotasPendientes = cuotas
    .filter((c) => c.estado === "pendiente" || c.estado === "parcial" || c.estado === "vencida")
    .map((c) => ({
      id: c.id,
      concepto: c.concepto,
      n: c.n,
      monto: c.monto,
      saldo: (Math.round((Number(c.monto) - Number(c.pagado)) * 100) / 100).toFixed(2),
      vence: c.vence,
      estado: c.estado,
    }));

  const comprobantes = await db
    .select({
      id: receipts.id,
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      emitidaAt: receipts.emitidaAt,
      patientId: payments.patientId,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .where(
      and(
        eq(receipts.tenantId, ctx.team.id),
        eq(payments.patientId, paciente.id),
        eq(receipts.sunatEstado, "aceptado"),
        inArray(receipts.tipo, ["boleta", "factura"]),
      ),
    );

  const presupuestos = await db
    .select({
      id: quotes.id,
      titulo: quotes.titulo,
      total: quotes.total,
      estado: quotes.estado,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(
      and(
        eq(quotes.patientId, paciente.id),
        inArray(quotes.estado, ["enviado", "aprobado"]),
      ),
    )
    .orderBy(desc(quotes.createdAt));

  const consentimientos = await db
    .select({
      id: signedConsents.id,
      servicioNombre: signedConsents.servicioNombre,
      signedBy: signedConsents.signedBy,
      signedAt: signedConsents.signedAt,
    })
    .from(signedConsents)
    .where(eq(signedConsents.patientId, paciente.id))
    .orderBy(signedConsents.signedAt);

  void logAudit({
    tenantId: ctx.team.id,
    accion: "portal.acceder",
    entidad: "patients",
    entidadId: paciente.id,
    payload: {
      via: "token_portal",
      ...(paciente.id !== ctx.patient.id ? { representanteId: ctx.patient.id } : {}),
    },
  });

  return NextResponse.json({
    clinica: { nombre: ctx.team.name, slug: ctx.team.slug },
    paciente: {
      id: paciente.id,
      nombre: paciente.nombre,
      alergias: paciente.alergias,
      antecedentes: paciente.antecedentes,
      medicacion: paciente.medicacion,
      gestacion: paciente.gestacion,
    },
    representados: [
      { id: ctx.patient.id, nombre: ctx.patient.nombre },
      ...representados,
    ],
    proximasCitas: proximas,
    historial,
    cuotasPendientes,
    comprobantes: comprobantes.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      numero: `${c.serie}-${String(c.correlativo).padStart(8, "0")}`,
      emitidaAt: c.emitidaAt,
    })),
    presupuestos: presupuestos.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      total: p.total,
      estado: p.estado,
    })),
    consentimientos: consentimientos.map((c) => ({
      servicioNombre: c.servicioNombre,
      signedBy: c.signedBy,
      signedAt: c.signedAt,
    })),
  });
}
