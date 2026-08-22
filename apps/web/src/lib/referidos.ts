import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, patients, appointments } from "@odontoflow/db";
import { appBaseUrl } from "@/lib/mail";

export function linkReferido(slug: string, codigo: string): string {
  return `${appBaseUrl()}/${slug}/reserva?ref=${encodeURIComponent(codigo)}`;
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generarCodigoReferido(): string {
  let codigo = "";
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return codigo;
}

export async function obtenerOCrearCodigoReferido(
  tenantId: string,
  patientId: string,
): Promise<string> {
  const db = getDb();
  const filas = await db
    .select({ codigo: patients.codigoReferido })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.tenantId, tenantId)))
    .limit(1);
  const actual = filas[0]?.codigo;
  if (actual) return actual;

  for (let intento = 0; intento < 5; intento++) {
    const codigo = generarCodigoReferido();
    const existe = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.tenantId, tenantId), eq(patients.codigoReferido, codigo)))
      .limit(1);
    if (existe.length > 0) continue;
    const [upd] = await db
      .update(patients)
      .set({ codigoReferido: codigo })
      .where(
        and(
          eq(patients.id, patientId),
          eq(patients.tenantId, tenantId),
          sql`${patients.codigoReferido} IS NULL`,
        ),
      )
      .returning({ codigo: patients.codigoReferido });
    if (upd?.codigo) return upd.codigo;
    const [relectura] = await db
      .select({ codigo: patients.codigoReferido })
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);
    if (relectura?.codigo) return relectura.codigo;
  }
  throw new Error("no_se_pudo_generar_codigo_referido");
}

export async function resolverReferentePorCodigo(
  tenantId: string,
  codigo: string,
): Promise<string | null> {
  const db = getDb();
  const filas = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.tenantId, tenantId),
        eq(patients.codigoReferido, codigo.trim().toUpperCase()),
        eq(patients.activo, true),
      ),
    )
    .limit(1);
  return filas[0]?.id ?? null;
}

export interface FilaInformeReferidos {
  patientId: string;
  nombre: string;
  celular: string;
  codigo: string | null;
  referidos: number;
  citasConfirmadas: number;
}

export async function informeReferidos(
  tenantId: string,
): Promise<FilaInformeReferidos[]> {
  const db = getDb();
  const referidos = await db
    .select({
      referenteId: patients.referidoPor,
      total: sql<number>`count(*)::int`,
      confirmadas: sql<number>`count(*) filter (where ${appointments.estado} in ('confirmada','atendida'))::int`,
    })
    .from(patients)
    .leftJoin(appointments, eq(appointments.patientId, patients.id))
    .where(and(eq(patients.tenantId, tenantId), isNotNull(patients.referidoPor)))
    .groupBy(patients.referidoPor);

  if (referidos.length === 0) return [];

  const ids = referidos.map((r) => r.referenteId as string);
  const referentes = await db
    .select({
      id: patients.id,
      nombre: patients.nombre,
      celular: patients.celular,
      codigo: patients.codigoReferido,
    })
    .from(patients)
    .where(and(eq(patients.tenantId, tenantId), inArray(patients.id, ids)));

  const mapa = new Map(referidos.map((r) => [r.referenteId as string, r]));
  return referentes
    .map((f) => {
      const agg = mapa.get(f.id);
      return {
        patientId: f.id,
        nombre: f.nombre,
        celular: f.celular,
        codigo: f.codigo,
        referidos: agg?.total ?? 0,
        citasConfirmadas: agg?.confirmadas ?? 0,
      };
    })
    .sort((a, b) => b.referidos - a.referidos);
}
