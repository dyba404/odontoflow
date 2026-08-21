import { and, eq } from "drizzle-orm";
import { getDb, paymentAllocations, payments, quotes } from "@odontoflow/db";

export type PaidSummary = {
  paymentId: string;
  paymentMonto: number;
  allocated: number;
  refunded: number;
  disponible: number;
};

export type QuotePaidSummary = {
  quoteId: string;
  total: number;
  pagado: number;
  saldo: number;
};

function num(v: string | number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function num2(v: string | number | null | undefined): number {
  return round2(num(v));
}

export async function computePaidSummary(tenantId: string, paymentId: string): Promise<PaidSummary | null> {
  const db = getDb();
  const [pago] = await db
    .select({ id: payments.id, monto: payments.monto })
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    .limit(1);
  if (!pago) return null;

  const allocs = await db
    .select({ monto: paymentAllocations.monto, kind: paymentAllocations.kind })
    .from(paymentAllocations)
    .where(and(eq(paymentAllocations.paymentId, paymentId), eq(paymentAllocations.tenantId, tenantId)));

  let allocated = 0;
  let refunded = 0;
  for (const a of allocs) {
    if (a.kind === "refund") refunded += num(a.monto);
    else allocated += num(a.monto);
  }
  const paymentMonto = num(pago.monto);
  return {
    paymentId,
    paymentMonto,
    allocated: round2(allocated),
    refunded: round2(refunded),
    disponible: Math.max(0, round2(paymentMonto - allocated + refunded)),
  };
}

export async function computeQuotePaid(tenantId: string, quoteId: string): Promise<QuotePaidSummary | null> {
  const db = getDb();
  const [q] = await db
    .select({ id: quotes.id, total: quotes.total })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)))
    .limit(1);
  if (!q) return null;

  const allocs = await db
    .select({ monto: paymentAllocations.monto, kind: paymentAllocations.kind })
    .from(paymentAllocations)
    .where(and(eq(paymentAllocations.quoteId, quoteId), eq(paymentAllocations.tenantId, tenantId)));

  let pagado = 0;
  for (const a of allocs) {
    pagado += a.kind === "refund" ? -num(a.monto) : num(a.monto);
  }
  const total = num(q.total);
  return {
    quoteId,
    total,
    pagado: round2(pagado),
    saldo: Math.max(0, round2(total - pagado)),
  };
}
