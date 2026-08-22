import { and, asc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import {
  getDb,
  payments,
  cashClosures,
  inventoryItems,
  inventoryLots,
  labOrders,
  quotes,
  installments,
  subscriptions,
  memberships,
  users,
  appointments,
  services,
} from "@odontoflow/db";
import { appBaseUrl } from "@/lib/mail";
import { computeSlots } from "@/lib/db";
import { pacientesDormidos } from "@/lib/console-data";

export interface SeccionDigest {
  titulo: string;
  detalle: string;
}

export interface DigestEquipo {
  secciones: SeccionDigest[];
  totalPendientes: number;
}

function fechaLocal(timezone: string, dias: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(Date.now() + dias * 24 * 3600_000),
  );
}

export async function emailOwner(tenantId: string): Promise<string | null> {
  const [fila] = await getDb()
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.teamId, tenantId), eq(memberships.role, "owner"), eq(memberships.active, true)))
    .limit(1);
  return fila?.email ?? null;
}

export async function computarDigest(opts: {
  tenantId: string;
  timezone: string;
}): Promise<DigestEquipo> {
  const db = getDb();
  const t = opts.tenantId;
  const secciones: SeccionDigest[] = [];
  let totalPendientes = 0;

  const ayer = fechaLocal(opts.timezone, -1);
  const inicioAyer = new Date(`${ayer}T00:00:00`);
  const finAyer = new Date(`${ayer}T23:59:59`);
  const pagosAyer = await db
    .select({ total: sql<number>`coalesce(sum(${payments.monto}::numeric), 0)`, n: sql<number>`count(*)` })
    .from(payments)
    .where(and(eq(payments.tenantId, t), gte(payments.createdAt, inicioAyer), lte(payments.createdAt, finAyer)));
  const montoAyer = Number(pagosAyer[0]?.total ?? 0);
  const [cierre] = await db
    .select({ id: cashClosures.id })
    .from(cashClosures)
    .where(and(eq(cashClosures.tenantId, t), eq(cashClosures.fecha, ayer)))
    .limit(1);
  if (montoAyer > 0 && !cierre) {
    secciones.push({
      titulo: "Caja de ayer sin cerrar",
      detalle: `Ayer se registraron pagos por S/ ${montoAyer.toFixed(2)} y la caja aún no se cerró.`,
    });
    totalPendientes++;
  }

  const stockBajo = await db
    .select({ nombre: inventoryItems.nombre, stock: inventoryItems.stock, stockMin: inventoryItems.stockMin })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.tenantId, t), eq(inventoryItems.activo, true)))
    .then((rows) => rows.filter((r) => Number(r.stock) <= Number(r.stockMin)));
  if (stockBajo.length > 0) {
    secciones.push({
      titulo: "Stock bajo",
      detalle: `${stockBajo.length} ítem(s) en o bajo el mínimo: ${stockBajo.slice(0, 5).map((r) => `${r.nombre} (${r.stock})`).join(", ")}${stockBajo.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const proximos30 = fechaLocal(opts.timezone, 30);
  const hoy = fechaLocal(opts.timezone, 0);
  const lotesPorVencer = await db
    .select({ lote: inventoryLots.lote, vence: inventoryLots.vence, nombre: inventoryItems.nombre })
    .from(inventoryLots)
    .innerJoin(inventoryItems, eq(inventoryLots.itemId, inventoryItems.id))
    .where(
      and(
        eq(inventoryItems.tenantId, t),
        isNotNull(inventoryLots.vence),
        gte(inventoryLots.vence, hoy),
        lte(inventoryLots.vence, proximos30),
      ),
    );
  if (lotesPorVencer.length > 0) {
    secciones.push({
      titulo: "Lotes por vencer (30 días)",
      detalle: `${lotesPorVencer.length} lote(s): ${lotesPorVencer.slice(0, 5).map((r) => `${r.nombre} L${r.lote} (${r.vence})`).join(", ")}${lotesPorVencer.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const labRetrasados = await db
    .select({ tipo: labOrders.tipo, fechaPromesa: labOrders.fechaPromesa })
    .from(labOrders)
    .where(
      and(
        eq(labOrders.tenantId, t),
        isNotNull(labOrders.fechaPromesa),
        lte(labOrders.fechaPromesa, hoy),
      ),
    );
  const labAbiertos = labRetrasados;
  if (labAbiertos.length > 0) {
    secciones.push({
      titulo: "Lab fuera de fecha promesa",
      detalle: `${labAbiertos.length} trabajo(s) de laboratorio: ${labAbiertos.slice(0, 5).map((r) => `${r.tipo} (${r.fechaPromesa})`).join(", ")}${labAbiertos.length > 5 ? "…" : ""}.`,
    });
    totalPendientes++;
  }

  const sinRespuesta = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.tenantId, t), eq(quotes.estado, "enviado")));
  if (sinRespuesta.length > 0) {
    secciones.push({
      titulo: "Presupuestos sin respuesta",
      detalle: `${sinRespuesta.length} presupuesto(s) enviados a la espera de respuesta.`,
    });
    totalPendientes++;
  }

  const cuotasVencidas = await db
    .select({ id: installments.id })
    .from(installments)
    .where(and(eq(installments.tenantId, t), eq(installments.estado, "vencida")));
  if (cuotasVencidas.length > 0) {
    secciones.push({
      titulo: "Cuotas vencidas",
      detalle: `${cuotasVencidas.length} cuota(s) vencidas por cobrar.`,
    });
    totalPendientes++;
  }

  const [sub] = await db
    .select({ estado: subscriptions.estado, vence: subscriptions.vence })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, t))
    .limit(1);
  if (sub && sub.estado === "por_renovar" && sub.vence) {
    secciones.push({
      titulo: "Plan por renovar",
      detalle: `Tu plan de Odontoflow vence el ${sub.vence}. Renueva en ${appBaseUrl()}/consola/config/suscripcion.`,
    });
    totalPendientes++;
  }

  const citasHoy = await db
    .select({ estado: appointments.estado })
    .from(appointments)
    .where(and(eq(appointments.tenantId, t), eq(appointments.fecha, hoy)));
  if (citasHoy.length > 0) {
    const porEstado = new Map<string, number>();
    for (const c of citasHoy) porEstado.set(c.estado, (porEstado.get(c.estado) ?? 0) + 1);
    const partes: string[] = [];
    const orden: Array<[string, string]> = [
      ["confirmada", "confirmadas"],
      ["solicitada", "por confirmar"],
      ["en_espera", "en espera"],
      ["en_atencion", "en atención"],
      ["atendida", "atendidas"],
    ];
    for (const [estado, label] of orden) {
      const n = porEstado.get(estado);
      if (n) partes.push(`${n} ${label}`);
    }
    secciones.push({
      titulo: "Agenda de hoy",
      detalle: `${citasHoy.length} cita(s): ${partes.join(", ")}.`,
    });
  }

  const dormidos = (await pacientesDormidos(t)).filter((p) => p.estado === "dormido");
  if (dormidos.length > 0) {
    secciones.push({
      titulo: "Recall: pacientes dormidos",
      detalle: `${dormidos.length} paciente(s) con 6 meses o más sin venir. Revísalos en Recall.`,
    });
    totalPendientes++;
  }

  const [svcCorto] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.tenantId, t), eq(services.activo, true)))
    .orderBy(asc(services.duracionMin))
    .limit(1);
  if (svcCorto) {
    let diasConHuecos = 0;
    let totalHuecos = 0;
    for (let d = 1; d <= 14; d++) {
      const fecha = fechaLocal(opts.timezone, d);
      const r = await computeSlots(t, { serviceId: svcCorto.id, date: fecha });
      const n = r?.slots.length ?? 0;
      if (n > 0) {
        diasConHuecos++;
        totalHuecos += n;
      }
    }
    if (diasConHuecos > 0) {
      secciones.push({
        titulo: "Huecos disponibles (14 días)",
        detalle: `${totalHuecos} franja(s) libres en ${diasConHuecos} día(s). Ofrécelas a pacientes en espera o recalls.`,
      });
    }
  }

  return { secciones, totalPendientes };
}

export function plantillaDigest(opts: {
  clinicaNombre: string;
  fecha: string;
  secciones: SeccionDigest[];
}): { asunto: string; html: string; texto: string } {
  const filas = opts.secciones
    .map(
      (s) =>
        `<tr><td style="padding:10px 0;vertical-align:top;"><strong style="color:#111827;">${s.titulo}</strong><br /><span style="color:#6b7280;font-size:13px;">${s.detalle}</span></td></tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f6f5f3;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#0d9488;padding:20px 32px;">
          <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">Resumen diario · ${opts.clinicaNombre}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#1f2937;">${opts.fecha}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5;">${filas}</table>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Resumen generado automáticamente por Odontoflow.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const texto = `Resumen diario · ${opts.clinicaNombre} · ${opts.fecha}\n\n${opts.secciones
    .map((s) => `• ${s.titulo}: ${s.detalle}`)
    .join("\n")}`;
  return {
    asunto: `Resumen diario — ${opts.fecha} | ${opts.clinicaNombre}`,
    html,
    texto,
  };
}
