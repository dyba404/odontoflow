import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { mkdir, writeFile } from "fs/promises";
import { join } from "node:path";
import { getDb, payments, patients, receipts, vatSettings } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { gatePlan, respuestaPlanInsuficiente } from "@/lib/plans";
import { attachmentsRoot } from "@/lib/attachments";
import { generarPdfComprobante } from "@/lib/comprobante-pdf";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("receipts.issue");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });
  const planCheck = await gatePlan(g.team.id, "facturacion");
  if (!planCheck.ok) return respuestaPlanInsuficiente(planCheck);

  const db = getDb();
  const [row] = await db
    .select({
      tipo: receipts.tipo,
      serie: receipts.serie,
      correlativo: receipts.correlativo,
      sunatEstado: receipts.sunatEstado,
      sunatHash: receipts.sunatHash,
      emitidaAt: receipts.emitidaAt,
      createdAt: receipts.createdAt,
      pdfUrl: receipts.pdfUrl,
      afectadoId: receipts.afectadoId,
      bajaMotivo: receipts.bajaMotivo,
      monto: payments.monto,
      metodo: payments.metodo,
      referencia: payments.referencia,
      clienteNombre: patients.nombre,
      clienteDocumento: patients.documento,
    })
    .from(receipts)
    .innerJoin(payments, eq(receipts.paymentId, payments.id))
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "comprobante_no_encontrado" }, { status: 404 });
  }

  const [afectado] = row.afectadoId
    ? await db
        .select({ serie: receipts.serie, correlativo: receipts.correlativo })
        .from(receipts)
        .where(and(eq(receipts.id, row.afectadoId), eq(receipts.tenantId, g.team.id)))
        .limit(1)
    : [];

  const [config] = await db
    .select({ razonSocial: vatSettings.razonSocial, ruc: vatSettings.ruc })
    .from(vatSettings)
    .where(eq(vatSettings.tenantId, g.team.id))
    .limit(1);

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generarPdfComprobante({
      tipo: row.tipo,
      serie: row.serie,
      correlativo: row.correlativo,
      sunatEstado: row.sunatEstado,
      sunatHash: row.sunatHash,
      emitidaAt: row.emitidaAt,
      createdAt: row.createdAt,
      monto: Number(row.monto),
      metodo: row.metodo,
      referencia: row.referencia,
      razonSocial: config?.razonSocial ?? g.team.name,
      ruc: config?.ruc ?? null,
      clienteNombre: row.clienteNombre,
      clienteDocumento: row.clienteDocumento,
      afectadoNumero: afectado
        ? `${afectado.serie}-${String(afectado.correlativo).padStart(8, "0")}`
        : null,
      bajaMotivo: row.bajaMotivo,
      teamName: g.team.name,
      timezone: g.team.timezone,
    });
  } catch {
    return NextResponse.json({ error: "pdf_no_generado" }, { status: 500 });
  }

  const numero = `${row.serie}-${String(row.correlativo).padStart(8, "0")}`;
  const nombreArchivo = `${numero}.pdf`;
  let pdfUrl = row.pdfUrl;
  try {
    const dir = join(attachmentsRoot(), "fiscal", g.team.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, nombreArchivo), pdfBytes);
    pdfUrl = `/fiscal/${g.team.id}/${nombreArchivo}`;
    if (pdfUrl !== row.pdfUrl) {
      await db
        .update(receipts)
        .set({ pdfUrl })
        .where(and(eq(receipts.id, id), eq(receipts.tenantId, g.team.id)));
    }
  } catch {
    pdfUrl = null;
  }

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "comprobante.pdf",
    entidad: "receipts",
    entidadId: id,
    payload: { numero },
  });

  if (!pdfUrl) {
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      },
    });
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
