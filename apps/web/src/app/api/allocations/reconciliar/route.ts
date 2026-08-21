import { NextResponse } from "next/server";
import { asc, eq, inArray, and } from "drizzle-orm";
import { getDb, paymentAllocations, payments } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { computePaidSummary } from "@/lib/allocations";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const pagos = await db
    .select({ id: payments.id, estado: payments.estado })
    .from(payments)
    .where(eq(payments.tenantId, g.team.id))
    .limit(500);

  const vistos = new Set<string>();
  const inconsistencias = [];
  for (const p of pagos) {
    if (vistos.has(p.id)) continue;
    vistos.add(p.id);
    const resumen = await computePaidSummary(g.team.id, p.id);
    if (!resumen) continue;
    const suma = Math.round((resumen.allocated - resumen.refunded) * 100);
    const monto = Math.round(resumen.paymentMonto * 100);
    if (suma > monto) {
      inconsistencias.push({
        paymentId: p.id,
        monto: resumen.paymentMonto,
        asignado: resumen.allocated,
        excedente: Math.round(suma - monto) / 100,
      });
    }
  }

  return NextResponse.json({ total: vistos.size, inconsistencias });
}

export async function POST() {
  const g = await guardStaff("payments.register");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const db = getDb();
  const pagos = await db
    .select({ id: payments.id, monto: payments.monto })
    .from(payments)
    .where(eq(payments.tenantId, g.team.id))
    .limit(500);

  let restauradas = 0;
  for (const pago of pagos) {
    const allocs = await db
      .select({ id: paymentAllocations.id, monto: paymentAllocations.monto, kind: paymentAllocations.kind })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, pago.id))
      .orderBy(asc(paymentAllocations.createdAt));
    if (allocs.length === 0) continue;

    const limite = Math.round(Number(pago.monto ?? 0) * 100);
    let neto = 0;
    const aEliminar: string[] = [];
    for (const a of allocs) {
      const val = Math.round(Number(a.monto ?? 0) * 100);
      const delta = a.kind === "refund" ? -val : val;
      if (neto + delta > limite) {
        aEliminar.push(a.id);
      } else {
        neto += delta;
      }
    }
    if (aEliminar.length > 0) {
      await db
        .delete(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.tenantId, g.team.id),
            inArray(paymentAllocations.id, aEliminar),
          ),
        );
      restauradas += aEliminar.length;
    }
  }

  return NextResponse.json({ ok: true, restauradas });
}
