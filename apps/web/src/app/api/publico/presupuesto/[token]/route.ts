import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, quotes, teams, budgetSignatures } from "@odontoflow/db";

export const dynamic = "force-dynamic";

const intentos = new Map<string, { n: number; bloqueadoHasta: number }>();
const MAX_INTENTOS = 5;

type RateLimiter = { n: number; bloqueadoHasta: number };

function rateLimitOk(token: string): boolean {
  const ahora = Date.now();
  let reg = intentos.get(token) as RateLimiter | undefined;
  if (!reg) {
    reg = { n: 0, bloqueadoHasta: 0 };
    intentos.set(token, reg);
  }
  if (reg.bloqueadoHasta > ahora) return false;
  if (reg.bloqueadoHasta > 0 && reg.bloqueadoHasta <= ahora) {
    reg.n = 0;
    reg.bloqueadoHasta = 0;
  }
  return true;
}

function registrarFallo(token: string): boolean {
  const reg = intentos.get(token);
  if (!reg) return false;
  reg.n += 1;
  if (reg.n >= MAX_INTENTOS) {
    reg.bloqueadoHasta = Date.now() + 15 * 60 * 1000;
    return true;
  }
  return false;
}

function limpiar(token: string) {
  intentos.delete(token);
}

function verificar2fa(
  twoFactor: { modo?: string; valorHash?: string } | null,
  body: { last4?: string; dob?: string; codigo?: string },
): "ok" | "fail" {
  const modo = twoFactor?.modo;
  const valorHash = twoFactor?.valorHash;
  if (!modo || !valorHash) return "fail";
  const valor =
    modo === "phone_last4" ? body.last4 : modo === "dob" ? body.dob : body.codigo;
  if (!valor) return "fail";
  const h = createHash("sha256").update(valor.trim().toLowerCase()).digest("hex");
  return h === valorHash ? "ok" : "fail";
}

async function buscarQuote(token: string) {
  const db = getDb();
  const [row] = await db
    .select({
      quote: quotes,
      clinicaNombre: teams.name,
    })
    .from(quotes)
    .leftJoin(teams, eq(quotes.tenantId, teams.id))
    .where(eq(quotes.linkToken, token))
    .limit(1);
  return row ?? null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!rateLimitOk(token)) {
    return NextResponse.json({ error: "demasiados_intentos" }, { status: 429 });
  }

  let body: {
    accion?: "verificar" | "aceptar";
    last4?: string;
    dob?: string;
    codigo?: string;
    firmanteNombre?: string;
    firmanteRol?: string;
    signatureData?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const row = await buscarQuote(token);
  if (!row) return NextResponse.json({ error: "link_no_valido" }, { status: 404 });

  const q = row.quote;
  if (q.expiraEn && q.expiraEn < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "presupuesto_vencido" }, { status: 410 });
  }

  const estado2fa = verificar2fa(q.linkTwoFactor as never, body);
  if (estado2fa !== "ok") {
    const bloqueado = registrarFallo(token);
    return NextResponse.json(
      { error: bloqueado ? "demasiados_intentos" : "two_factor_incorrecto" },
      { status: bloqueado ? 429 : 401 },
    );
  }

  if (body.accion !== "aceptar") {
    limpiar(token);
    return NextResponse.json({
      presupuesto: {
        titulo: q.titulo,
        items: q.items,
        total: q.total,
        expiraEn: q.expiraEn,
        estado: q.estado,
        clinicaNombre: row.clinicaNombre ?? "Clínica",
      },
    });
  }

  if (q.estado === "aprobado" || q.estado === "convertido") {
    return NextResponse.json({ error: "presupuesto_ya_aceptado" }, { status: 400 });
  }

  const firmanteNombre = body.firmanteNombre?.trim();
  const signatureData = body.signatureData;
  if (!firmanteNombre || !signatureData || !signatureData.startsWith("data:image/png")) {
    return NextResponse.json({ error: "firma_requerida" }, { status: 400 });
  }
  const firmanteRol = body.firmanteRol === "tutor" ? "tutor" : "paciente";

  const signedAt = new Date();
  const signatureSha256 = createHash("sha256")
    .update(
      JSON.stringify({
        quoteId: q.id,
        titulo: q.titulo,
        items: q.items,
        total: q.total,
        firma: firmanteNombre,
        fecha: signedAt.toISOString(),
      }),
    )
    .digest("hex");

  const db = getDb();
  const [firma] = await db
    .insert(budgetSignatures)
    .values({
      tenantId: q.tenantId,
      quoteId: q.id,
      firmanteNombre,
      firmanteRol,
      signatureData,
      signatureSha256,
      ip: req.headers.get("x-forwarded-for") ?? "local",
      userAgent: req.headers.get("user-agent") ?? null,
      signedAt,
    })
    .returning({ id: budgetSignatures.id });

  await db
    .update(quotes)
    .set({
      estado: "aprobado",
      acceptedVia: "link_publico",
      acceptedAt: signedAt,
      updatedAt: signedAt,
    })
    .where(eq(quotes.id, q.id));

  limpiar(token);
  return NextResponse.json({ ok: true, firmaId: firma?.id ?? null });
}
