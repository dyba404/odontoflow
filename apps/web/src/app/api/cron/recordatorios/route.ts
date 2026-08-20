import { NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, notLike, or } from "drizzle-orm";
import {
  getDb,
  teams,
  appointments,
  patients,
  services,
  reminders,
} from "@odontoflow/db";
import { plantillaRecordatorio24h, fechaLargaEs } from "@/lib/notify";
import { enviarRecordatorio, getNotificationSettings } from "@/lib/reminder-engine";
import { planDeTenantSinCache, planEsProOMayor } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Ejecuta `tareas` en paralelo con concurrencia limitada (5 a la vez) para
// no saturar la API de WhatsApp ni la DB con 100 tenants confirmando a la vez,
// pero tampoco serializar el job (antes era 1 por 1 y el job se cortaba a mitad).
async function enParalelo<T>(tareas: Array<() => Promise<T>>, concurrencia = 5): Promise<T[]> {
  const resultados: T[] = [];
  let i = 0;
  async function trabajador(): Promise<void> {
    while (i < tareas.length) {
      const idx = i++;
      const tarea = tareas[idx];
      if (!tarea) return;
      resultados[idx] = await tarea();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrencia, tareas.length) }, trabajador));
  return resultados;
}

function mananaTenant(timezone: string): string {
  const manana = new Date(Date.now() + 24 * 3600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(manana);
}

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();
  const clinics = await db.select({
    id: teams.id,
    name: teams.name,
    slug: teams.slug,
    timezone: teams.timezone,
  }).from(teams);

  const planPorTenant = new Map<string, boolean>();
  for (const team of clinics) {
    planPorTenant.set(team.id, planEsProOMayor(await planDeTenantSinCache(team.id)));
  }

  let enviados = 0;
  let omitidos = 0;
  let reintentos = 0;

  for (const team of clinics) {
    if (!planPorTenant.get(team.id)) {
      omitidos++;
      continue;
    }
    const settings = await getNotificationSettings(team.id);
    if (settings && !settings.recordatorio24h) continue;

    const fecha = mananaTenant(team.timezone);
    const citas = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        horaIni: appointments.horaIni,
        pacienteNombre: patients.nombre,
        pacienteEmail: patients.email,
        pacienteCelular: patients.celular,
        servicio: services.nombre,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .where(
        and(
          eq(appointments.tenantId, team.id),
          eq(appointments.fecha, fecha),
          eq(appointments.estado, "confirmada"),
        ),
      )
      .orderBy(asc(appointments.horaIni));

      // Filtrado secuencial (dedup por cita), envío en paralelo (5 a la vez).
      type Trabajo = Parameters<typeof enviarRecordatorio>[0];
      const trabajos: Trabajo[] = [];
      for (const cita of citas) {
        if (!cita.pacienteEmail && !cita.pacienteCelular) {
          omitidos++;
          continue;
        }
        const [ya] = await db
          .select({ id: reminders.id })
          .from(reminders)
          .where(
            and(
              eq(reminders.citaId, cita.id),
              eq(reminders.tipo, "recordatorio_24h"),
            ),
          )
          .limit(1);
        if (ya) {
          omitidos++;
          continue;
        }
        const plantilla = plantillaRecordatorio24h({
          cita: {
            fecha,
            horaIni: cita.horaIni,
            servicio: cita.servicio,
            clinicaNombre: team.name,
            clinicaSlug: team.slug,
          },
        });
        trabajos.push({
          tenantId: team.id,
          tipo: "recordatorio_24h",
          pacienteId: cita.patientId,
          citaId: cita.id,
          destinatario: cita.pacienteEmail,
          plantilla,
          celularPaciente: cita.pacienteCelular,
          waPlantilla: {
            nombre: settings?.plantillaRecordatorio ?? "recordatorio_cita",
            idioma: settings?.idiomaPlantilla ?? "es",
            parametros: [cita.pacienteNombre, fechaLargaEs(fecha), cita.horaIni, team.name],
          },
        });
      }

      await enParalelo(
        trabajos.map(
          (t) => async () => {
            const r = await enviarRecordatorio(t);
            if (r.ok) enviados++;
            else omitidos++;
          },
        ),
      );
    }

  const desde = new Date(Date.now() - 48 * 3600_000);
  for (const team of clinics) {
    if (!planPorTenant.get(team.id)) continue;
    const fallidos = await db
      .select({
        id: reminders.id,
        citaId: reminders.citaId,
      })
      .from(reminders)
      .where(
        and(
          eq(reminders.tenantId, team.id),
          eq(reminders.tipo, "recordatorio_24h"),
          eq(reminders.estado, "error"),
          or(isNull(reminders.error), notLike(reminders.error, "%reintento%")),
          gte(reminders.createdAt, desde),
        ),
      );

      // Preparación secuencial (lectura de citas), reenvío en paralelo (5 a la vez).
      type Reintento = Parameters<typeof enviarRecordatorio>[0] & { fallaId: string };
      const reintentar: Reintento[] = [];
      for (const falla of fallidos) {
        if (!falla.citaId) continue;
        const [cita] = await db
          .select({
            id: appointments.id,
            patientId: appointments.patientId,
            fecha: appointments.fecha,
            horaIni: appointments.horaIni,
            pacienteNombre: patients.nombre,
            pacienteEmail: patients.email,
            pacienteCelular: patients.celular,
            servicio: services.nombre,
          })
          .from(appointments)
          .innerJoin(patients, eq(appointments.patientId, patients.id))
          .innerJoin(services, eq(appointments.serviceId, services.id))
          .where(
            and(
              eq(appointments.id, falla.citaId),
              eq(appointments.tenantId, team.id),
            ),
          )
          .limit(1);
        if (!cita) continue;

        const settings = await getNotificationSettings(team.id);
        const plantilla = plantillaRecordatorio24h({
          cita: {
            fecha: cita.fecha,
            horaIni: cita.horaIni,
            servicio: cita.servicio,
            clinicaNombre: team.name,
            clinicaSlug: team.slug,
          },
        });
        reintentar.push({
          tenantId: team.id,
          tipo: "recordatorio_24h",
          pacienteId: cita.patientId,
          citaId: cita.id,
          destinatario: cita.pacienteEmail,
          plantilla,
          celularPaciente: cita.pacienteCelular,
          waPlantilla: {
            nombre: settings?.plantillaRecordatorio ?? "recordatorio_cita",
            idioma: settings?.idiomaPlantilla ?? "es",
            parametros: [cita.pacienteNombre, fechaLargaEs(cita.fecha), cita.horaIni, team.name],
          },
          reminderIdActualizar: falla.id,
          fallaId: falla.id,
        });
      }

      await enParalelo(
        reintentar.map((t) => async () => {
          const { fallaId, ...payload } = t;
          const r = await enviarRecordatorio(payload);
          if (r.ok) reintentos++;
          else {
            await db
              .update(reminders)
              .set({ error: `${r.error ?? "error_desconocido"} | reintento fallido` })
              .where(eq(reminders.id, fallaId));
          }
        }),
      );
    }

  return NextResponse.json({ ok: true, enviados, omitidos, reintentos });
}
