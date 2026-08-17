import { NextResponse } from "next/server";
import { and, eq, gte, or } from "drizzle-orm";
import { getDb, receipts } from "@odontoflow/db";
import { emitirComprobante } from "@/lib/emitir";

export const dynamic = "force-dynamic";

function bearerValido(req: Request): boolean {
  const esperado = process.env.CRON_SECRET ?? "dev-cron-secret";
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${esperado}`;
}

export async function POST(req: Request) {
  if (!bearerValido(req)) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const db = getDb();
  const hace7d = new Date(Date.now() - 7 * 24 * 3600_000);
  const hace48h = new Date(Date.now() - 48 * 3600_000);

  const pendientes = await db
    .select({ id: receipts.id, tenantId: receipts.tenantId })
    .from(receipts)
    .where(
      or(
        and(eq(receipts.sunatEstado, "pendiente_envio"), gte(receipts.createdAt, hace7d)),
        and(eq(receipts.sunatEstado, "rechazado"), gte(receipts.createdAt, hace48h)),
      ),
    );

  let reemitidos = 0;
  let rechazados = 0;
  let errores = 0;

  for (const row of pendientes) {
    const res = await emitirComprobante({ tenantId: row.tenantId, receiptId: row.id });
    if (res.ok) {
      reemitidos += 1;
    } else if (res.error === "rechazado_sunat") {
      rechazados += 1;
    } else {
      errores += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: pendientes.length,
    reemitidos,
    rechazados,
    errores,
  });
}
