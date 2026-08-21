import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, quotes } from "@odontoflow/db";
import { guardStaff, guardError } from "@/lib/auth";
import { logAuditSesion } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MODOS = ["phone_last4", "dob", "manual_code"] as const;
type Modo = (typeof MODOS)[number];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  let body: { modo?: string; valor?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const modo = body.modo as Modo;
  const valor = body.valor?.trim();
  if (!MODOS.includes(modo) || !valor) {
    return NextResponse.json({ error: "two_factor_invalido" }, { status: 400 });
  }
  if (modo === "phone_last4" && !/^\d{4}$/.test(valor)) {
    return NextResponse.json({ error: "ultimos4_invalidos" }, { status: 400 });
  }
  if (modo === "dob" && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return NextResponse.json({ error: "fecha_nacimiento_invalida" }, { status: 400 });
  }
  if (modo === "manual_code" && (valor.length < 4 || valor.length > 20)) {
    return NextResponse.json({ error: "codigo_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [quote] = await db
    .select({ id: quotes.id, estado: quotes.estado, tenantId: quotes.tenantId })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!quote) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });

  const linkToken = randomBytes(32).toString("hex");
  const valorHash = createHash("sha256").update(valor.toLowerCase()).digest("hex");

  const set: Record<string, unknown> = {
    linkToken,
    linkTwoFactor: { modo, valorHash },
  };
  if (quote.estado === "borrador") set.estado = "enviado";

  await db.update(quotes).set(set).where(eq(quotes.id, id));

  void logAuditSesion({
    tenantId: g.team.id,
    accion: "presupuesto.link_publico",
    entidad: "quotes",
    entidadId: id,
    payload: { modo },
  });

  const base = process.env.PUBLIC_URL || "http://localhost:3111";
  return NextResponse.json({ ok: true, url: `${base}/s/presupuesto/${linkToken}` });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const g = await guardStaff("quotes.manage");
  if (!g.ok) return NextResponse.json({ error: guardError(g) }, { status: g.status });

  const [quote] = await getDb()
    .select({ linkToken: quotes.linkToken, linkTwoFactor: quotes.linkTwoFactor })
    .from(quotes)
    .where(and(eq(quotes.id, id), eq(quotes.tenantId, g.team.id)))
    .limit(1);
  if (!quote) return NextResponse.json({ error: "presupuesto_no_encontrado" }, { status: 404 });
  if (!quote.linkToken) return NextResponse.json({ url: null });

  const base = process.env.PUBLIC_URL || "http://localhost:3111";
  return NextResponse.json({
    url: `${base}/s/presupuesto/${quote.linkToken}`,
    modo: (quote.linkTwoFactor as { modo?: string } | null)?.modo ?? null,
  });
}
