import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, paymentAllocations } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const [row] = await db
    .delete(paymentAllocations)
    .where(and(eq(paymentAllocations.id, id), eq(paymentAllocations.tenantId, g.team.id)))
    .returning({ id: paymentAllocations.id, paymentId: paymentAllocations.paymentId, quoteId: paymentAllocations.quoteId, monto: paymentAllocations.monto, kind: paymentAllocations.kind });
  if (!row) return NextResponse.json({ error: "allocation_no_encontrada" }, { status: 404 });

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "pago.allocation_eliminar",
    entidad: "payment_allocations",
    entidadId: id,
    payload: { paymentId: row.paymentId, quoteId: row.quoteId, monto: row.monto, kind: row.kind },
  });

  return NextResponse.json({ ok: true });
}
