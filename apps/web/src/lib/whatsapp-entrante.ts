import { and, asc, eq, gte, lte, inArray } from "drizzle-orm";
import { getDb, appointments, reminders, services, teams } from "@odontoflow/db";
import { logAudit } from "@/lib/audit";
import { descifrar } from "@/lib/crypto";
import { ensureMagicToken, magicUrl } from "@/lib/magic-link";
import {
  enviarWhatsApp,
  whatsAppConfigurada,
  type WhatsAppResultado,
} from "@/lib/whatsapp";
import { getWhatsAppSettings } from "@/lib/reminder-engine";
import { fechaLargaEs, plantillaConfirmacionSolicitud } from "@/lib/notify";
import { enviarRecordatorio } from "@/lib/reminder-engine";

const KEYWORDS_CONFIRMAR = new Set([
  "SI",
  "CONFIRMO",
  "CONFIRMAR",
  "CONFIRME",
  "CONFIRMADO",
  "CONFIRMADA",
  "ASISTO",
  "ASISTIRE",
  "OK",
  "DALE",
]);

const KEYWORDS_GESTIONAR = new Set([
  "REPROGRAMAR",
  "REPROGRAMO",
  "CANCELAR",
  "CANCEL",
  "CAMBIAR",
  "CAMBIO",
  "NO PUEDO",
  "NO VOY",
]);

export type AccionEntrante = "confirmar" | "gestionar" | null;

export function clasificarMensaje(texto: string): AccionEntrante {
  const normalizado = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¡¿"()]/g, " ")
    .trim();
  if (!normalizado) return null;
  const palabras = normalizado.split(/\s+/);
  if (palabras.some((p) => KEYWORDS_GESTIONAR.has(p))) return "gestionar";
  if (palabras.some((p) => KEYWORDS_CONFIRMAR.has(p))) return "confirmar";
  return null;
}

function fechaLima(d: Date, tz = "America/Lima"): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const q of partes) p[q.type] = q.value;
  return `${p.year}-${p.month}-${p.day}`;
}

function inicioDeDiaLima(d: Date, tz = "America/Lima"): Date {
  const fecha = fechaLima(d, tz);
  return new Date(`${fecha}T00:00:00-05:00`);
}

export interface ResultadoEntrante {
  ok: boolean;
  accion: AccionEntrante;
  respuesta?: string;
  estadoCita?: string;
  motivo?: string;
}

export async function procesarMensajeEntrante(opts: {
  tenantId: string;
  patientId: string;
  patientEmail: string | null;
  waId: string;
  texto: string;
}): Promise<ResultadoEntrante> {
  const accion = clasificarMensaje(opts.texto);
  if (!accion) return { ok: false, accion: null, motivo: "sin_keyword" };

  const db = getDb();
  const [team] = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, timezone: teams.timezone })
    .from(teams)
    .where(eq(teams.id, opts.tenantId))
    .limit(1);
  if (!team) return { ok: false, accion, motivo: "tenant_no_encontrado" };

  const hoy = inicioDeDiaLima(new Date(), team.timezone);
  const [previo] = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        eq(reminders.tenantId, opts.tenantId),
        eq(reminders.pacienteId, opts.patientId),
        eq(reminders.tipo, "confirmacion_solicitud"),
        eq(reminders.canal, "whatsapp"),
        gte(reminders.createdAt, hoy),
      ),
    )
    .limit(1);
  if (previo) {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion, omitido: "una_respuesta_por_dia" },
    });
    return { ok: false, accion, motivo: "ya_respondido_hoy" };
  }

  const diaMax = fechaLima(new Date(Date.now() + 48 * 3600_000), team.timezone);
  const diaHoy = fechaLima(new Date(), team.timezone);
  const [cita] = await db
    .select({
      id: appointments.id,
      estado: appointments.estado,
      fecha: appointments.fecha,
      horaIni: appointments.horaIni,
      serviceId: appointments.serviceId,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, opts.tenantId),
        eq(appointments.patientId, opts.patientId),
        inArray(appointments.estado, ["solicitada", "confirmada"]),
        gte(appointments.fecha, diaHoy),
        lte(appointments.fecha, diaMax),
      ),
    )
    .orderBy(asc(appointments.fecha), asc(appointments.horaIni))
    .limit(1);

  if (!cita) {
    void logAudit({
      tenantId: opts.tenantId,
      accion: "whatsapp.auto_respuesta",
      entidad: "whatsapp",
      payload: { accion, omitido: "sin_cita_proxima" },
    });
    return { ok: false, accion, motivo: "sin_cita_proxima" };
  }

  const waSettings = await getWhatsAppSettings(opts.tenantId);
  if (!whatsAppConfigurada(waSettings) || !waSettings?.phoneNumberId || !waSettings.tokenEnc) {
    return { ok: false, accion, motivo: "whatsapp_no_configurado" };
  }
  let token: string;
  try {
    token = descifrar(waSettings.tokenEnc);
  } catch {
    return { ok: false, accion, motivo: "whatsapp_no_configurado" };
  }

  let respuesta = "";
  let estadoCita = cita.estado as string;

  if (accion === "gestionar") {
    const mgToken = await ensureMagicToken(opts.tenantId, opts.patientId, cita.id);
    respuesta = `Claro, puedes reprogramar o cancelar tu cita del ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni} aquí: ${magicUrl(team.slug, mgToken)}\nEl enlace es personal y válido por 30 días.`;
  } else {
    if (cita.estado === "solicitada") {
      const [updated] = await db
        .update(appointments)
        .set({ estado: "confirmada", updatedAt: new Date() })
        .where(and(eq(appointments.id, cita.id), eq(appointments.estado, "solicitada")))
        .returning({ id: appointments.id, estado: appointments.estado });
      if (updated) {
        estadoCita = updated.estado;
        void logAudit({
          tenantId: opts.tenantId,
          accion: "whatsapp.auto_confirmacion",
          entidad: "citas",
          entidadId: cita.id,
          payload: { via: "whatsapp_entrante", numero: opts.waId },
        });

        const [svc] = await db
          .select({ nombre: services.nombre })
          .from(services)
          .where(eq(services.id, cita.serviceId))
          .limit(1);
        if (opts.patientEmail) {
          const plantilla = plantillaConfirmacionSolicitud({
            cita: {
              fecha: cita.fecha,
              horaIni: cita.horaIni,
              servicio: svc?.nombre ?? "",
              clinicaNombre: team.name,
              clinicaSlug: team.slug,
            },
            magicUrl: magicUrl(team.slug, await ensureMagicToken(opts.tenantId, opts.patientId, cita.id)),
          });
          await enviarRecordatorio({
            tenantId: opts.tenantId,
            tipo: "confirmacion_solicitud",
            pacienteId: opts.patientId,
            citaId: cita.id,
            destinatario: opts.patientEmail,
            plantilla,
            celularPaciente: null,
          }).catch(() => {});
        }
      }
      respuesta = `✓ Tu cita quedó confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Te esperamos. Si necesitas cambiarla, responde CAMBIAR y te enviaremos un enlace.`;
    } else {
      respuesta = `¡Gracias! Tu cita ya está confirmada para el ${fechaLargaEs(cita.fecha)} a las ${cita.horaIni}. Te esperamos.`;
    }
  }

  const envio: WhatsAppResultado = await enviarWhatsApp(opts.waId, token, waSettings.phoneNumberId, respuesta);

  const [rem] = await db
    .insert(reminders)
    .values({
      tenantId: opts.tenantId,
      tipo: "confirmacion_solicitud",
      estado: envio.ok ? "enviado" : "error",
      pacienteId: opts.patientId,
      citaId: cita.id,
      canal: "whatsapp",
      destinatario: opts.waId,
      mensaje: respuesta,
      error: envio.ok ? null : (envio.reason ?? "error_whatsapp"),
      enviadoAt: new Date(),
    })
    .returning({ id: reminders.id });

  void logAudit({
    tenantId: opts.tenantId,
    accion: "whatsapp.auto_respuesta",
    entidad: "reminders",
    ...(rem?.id ? { entidadId: rem.id } : {}),
    payload: {
      accion,
      estadoCita,
      enviado: envio.ok,
      motivo: envio.ok ? null : (envio.reason ?? "error_whatsapp"),
    },
  });

  return { ok: envio.ok, accion, respuesta, estadoCita, motivo: envio.ok ? undefined : envio.reason };
}
