import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { getDb, teams, budgetAccessLogs } from "@odontoflow/db";
import { mailConfigurado, sendMail } from "@/lib/mail";
import { computarDigest, emailOwner, plantillaDigest } from "@/lib/digest";
import { getNotificationSettings } from "@/lib/reminder-engine";
import { planDeTenantSinCache, planEsProOMayor } from "@/lib/plans";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

  // Purga 90d de budget_access_logs (visión §2.2(5): privacidad, nunca IP cruda).
  // Corre aunque el correo no esté configurado: es requisito de privacidad.
  const corte90d = new Date(Date.now() - 90 * 24 * 3600_000);
  const purgados = await db
    .delete(budgetAccessLogs)
    .where(lt(budgetAccessLogs.createdAt, corte90d))
    .returning({ id: budgetAccessLogs.id });

  if (!mailConfigurado()) {
    return NextResponse.json({
      ok: true,
      omitido: "email_no_configurado",
      enviados: 0,
      accessLogsPurgados: purgados.length,
    });
  }

  const clinics = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, timezone: teams.timezone })
    .from(teams);

  let enviados = 0;
  let omitidos = 0;

  for (const team of clinics) {
    const plan = await planDeTenantSinCache(team.id);
    if (!planEsProOMayor(plan)) {
      omitidos++;
      continue;
    }
    const settings = await getNotificationSettings(team.id);
    if (settings && !settings.digestDiario) {
      omitidos++;
      continue;
    }

    const digest = await computarDigest({ tenantId: team.id, timezone: team.timezone });
    if (digest.totalPendientes === 0) {
      omitidos++;
      continue;
    }

    const owner = await emailOwner(team.id);
    if (!owner) {
      omitidos++;
      continue;
    }

    const fecha = new Intl.DateTimeFormat("es-PE", {
      timeZone: team.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const tpl = plantillaDigest({
      clinicaNombre: team.name,
      fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1),
      secciones: digest.secciones,
    });
    const r = await sendMail({
      to: owner,
      subject: tpl.asunto,
      html: tpl.html,
      text: tpl.texto,
    });
    if (r.ok) enviados++;
    else omitidos++;

    void logAudit({
      tenantId: team.id,
      accion: "digest.enviar",
      entidad: "teams",
      entidadId: team.id,
      payload: { destinatario: owner, enviado: r.ok, pendientes: digest.totalPendientes },
    });
  }

  return NextResponse.json({ ok: true, enviados, omitidos, accessLogsPurgados: purgados.length });
}
