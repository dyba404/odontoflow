import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, quotes, teams, budgetSignatures, budgetAccessLogs, attachments } from "@odontoflow/db";
import { join } from "node:path";
import {
  MAX_FALLOS_ACUMULADOS,
  MAX_FALLOS_VENTANA,
  VENTANA_MS,
  compararHash2fa,
  firmarCookiePresupuesto,
  hashIp,
  hashValor2fa,
  nombreCookiePresupuesto,
  opcionesCookiePresupuesto,
  verificarCookiePresupuesto,
} from "@/lib/budget-link";
import { pdfPresupuestoFirmado } from "@/lib/presupuesto-pdf";
import { attachmentsRoot, getStorage } from "@/lib/storage";
import { ipReq } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type TwoFactor = { modo?: string; valorHash?: string } | null;

function ipDe(req: Request): string {
  return ipReq(req);
}

async function buscarQuote(token: string) {
  const db = getDb();
  const [row] = await db
    .select({
      quote: quotes,
      clinicaNombre: teams.name,
      clinicaSlug: teams.slug,
    })
    .from(quotes)
    .leftJoin(teams, eq(quotes.tenantId, teams.id))
    .where(eq(quotes.linkToken, token))
    .limit(1);
  return row ?? null;
}

async function logAcceso(
  tenantId: string,
  quoteId: string,
  evento: string,
  req: Request,
) {
  try {
    await getDb().insert(budgetAccessLogs).values({
      tenantId,
      quoteId,
      evento,
      ipHash: hashIp(ipDe(req)),
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
  } catch {
    // best-effort: el log nunca debe romper el flujo
  }
}

/** Fallos en ventana rodante de 15 min (persistente, no en memoria). */
async function fallosEnVentana(quoteId: string): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_MS);
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(budgetAccessLogs)
    .where(
      and(
        eq(budgetAccessLogs.quoteId, quoteId),
        eq(budgetAccessLogs.evento, "2fa_fallo"),
        gte(budgetAccessLogs.createdAt, desde),
      ),
    );
  return row?.n ?? 0;
}

function verificar2fa(twoFactor: TwoFactor, body: { last4?: string; dob?: string; codigo?: string }): boolean {
  const modo = twoFactor?.modo;
  const valorHash = twoFactor?.valorHash;
  if (!modo || !valorHash) return false;
  const valor = modo === "phone_last4" ? body.last4 : modo === "dob" ? body.dob : body.codigo;
  if (!valor) return false;
  return compararHash2fa(valorHash, hashValor2fa(modo, valor));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let body: {
    accion?: "verificar" | "aceptar" | "rechazar";
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
  const db = getDb();

  // Orden de rechazo (visión §2.2(5)): locked → expired → método → rate-limit → comparar.
  if (q.linkLockedAt) {
    await logAcceso(q.tenantId, q.id, "acceso_bloqueado", req);
    return NextResponse.json({ error: "link_bloqueado" }, { status: 423 });
  }

  if (q.expiraEn && q.expiraEn < new Date().toISOString().slice(0, 10)) {
    await logAcceso(q.tenantId, q.id, "acceso_vencido", req);
    return NextResponse.json({ error: "presupuesto_vencido" }, { status: 410 });
  }

  // "aceptar"/"rechazar" exigen la cookie firmada de verificación previa (path acotado).
  const requiereVerificacion = body.accion === "aceptar" || body.accion === "rechazar";
  if (requiereVerificacion) {
    const store = await cookies();
    const cookieOk = verificarCookiePresupuesto(
      token,
      store.get(nombreCookiePresupuesto(token))?.value,
    );
    if (!cookieOk) {
      await logAcceso(
        q.tenantId,
        q.id,
        body.accion === "rechazar" ? "rechazar_sin_verificacion" : "aceptar_sin_verificacion",
        req,
      );
      return NextResponse.json({ error: "verificacion_requerida" }, { status: 401 });
    }
  } else {
    // "verificar": rate-limit por fallos en ventana rodante + comparar 2FA.
    const fallos = await fallosEnVentana(q.id);
    if (fallos >= MAX_FALLOS_VENTANA) {
      await logAcceso(q.tenantId, q.id, "rate_limit", req);
      return NextResponse.json({ error: "demasiados_intentos" }, { status: 429 });
    }

    const dosFaOk = verificar2fa(q.linkTwoFactor as TwoFactor, body);
    if (!dosFaOk) {
      await logAcceso(q.tenantId, q.id, "2fa_fallo", req);
      const [actualizado] = await db
        .update(quotes)
        .set({ linkFailCount: sql`${quotes.linkFailCount} + 1` })
        .where(eq(quotes.id, q.id))
        .returning({ linkFailCount: quotes.linkFailCount });
      const total = actualizado?.linkFailCount ?? 0;
      if (total >= MAX_FALLOS_ACUMULADOS && !q.linkLockedAt) {
        await db
          .update(quotes)
          .set({ linkLockedAt: new Date() })
          .where(eq(quotes.id, q.id));
        await logAcceso(q.tenantId, q.id, "link_bloqueado_permanente", req);
        return NextResponse.json({ error: "link_bloqueado" }, { status: 423 });
      }
      return NextResponse.json({ error: "two_factor_incorrecto" }, { status: 401 });
    }

    await logAcceso(q.tenantId, q.id, "2fa_ok", req);
    const res = NextResponse.json({
      presupuesto: {
        titulo: q.titulo,
        items: q.items,
        total: q.total,
        expiraEn: q.expiraEn,
        estado: q.estado,
        clinicaNombre: row.clinicaNombre ?? "Clínica",
      },
    });
    res.cookies.set(
      nombreCookiePresupuesto(token),
      firmarCookiePresupuesto(token),
      opcionesCookiePresupuesto(token),
    );
    return res;
  }

  if (q.estado === "aprobado" || q.estado === "convertido") {
    return NextResponse.json({ error: "presupuesto_ya_aceptado" }, { status: 400 });
  }

  // Rechazo desde el portal: sin firma ni PDF; solo estado + log de acceso.
  if (body.accion === "rechazar") {
    if (q.estado === "rechazado") {
      return NextResponse.json({ error: "presupuesto_ya_rechazado" }, { status: 400 });
    }

    const ahora = new Date();
    await db
      .update(quotes)
      .set({ estado: "rechazado", updatedAt: ahora })
      .where(eq(quotes.id, q.id));

    await logAcceso(q.tenantId, q.id, "rechazado", req);

    const res = NextResponse.json({ ok: true });
    res.cookies.delete({
      name: nombreCookiePresupuesto(token),
      path: `/api/publico/presupuesto/${token}`,
    });
    return res;
  }

  const firmanteNombre = body.firmanteNombre?.trim();
  const signatureData = body.signatureData;
  if (!firmanteNombre || !signatureData || !signatureData.startsWith("data:image/png")) {
    return NextResponse.json({ error: "firma_requerida" }, { status: 400 });
  }
  const firmanteRol = body.firmanteRol === "tutor" ? "tutor" : "paciente";
  const match = signatureData.match(/^data:image\/png;base64,(.+)$/);
  if (!match || !match[1]) return NextResponse.json({ error: "firma_requerida" }, { status: 400 });
  const pngBytes = Buffer.from(match[1], "base64");
  if (pngBytes.length > 512 * 1024) {
    return NextResponse.json({ error: "firma_muy_grande" }, { status: 413 });
  }

  const signedAt = new Date();
  const ipHash = hashIp(ipDe(req));
  const userAgent = req.headers.get("user-agent") ?? null;

  // PDF firmado + SHA-256 del documento = evidencia anti-tamper (visión §2.2(6)).
  const pdfBytes = await pdfPresupuestoFirmado({
    clinicaNombre: row.clinicaNombre ?? "Clínica",
    titulo: q.titulo,
    items: (q.items as Array<{ descripcion?: string; cantidad?: number; precioUnitario?: number }>) ?? [],
    total: Number(q.total),
    expiraEn: q.expiraEn,
    firmanteNombre,
    firmanteRol,
    signaturePng: pngBytes,
    signedAt,
    ipHash,
    userAgent,
  });
  const documentHash = createHash("sha256").update(pdfBytes).digest("hex");

  const attachmentId = randomUUID();
  const storage = getStorage();
  const storageKey = join(q.tenantId, `presupuesto-firmado-${attachmentId}.pdf`);
  const storagePath =
    storage.driver === "local" ? join(attachmentsRoot(), storageKey) : storageKey;
  await storage.put(storagePath, pdfBytes, "application/pdf", pdfBytes.length);

  const [attachment] = await db
    .insert(attachments)
    .values({
      tenantId: q.tenantId,
      patientId: q.patientId,
      tipo: "otro",
      nombre: `presupuesto-firmado-${q.titulo.slice(0, 40)}.pdf`,
      mime: "application/pdf",
      sizeBytes: pdfBytes.length,
      storagePath,
      storage: storage.driver,
      nota: `Aceptación firmada: ${q.titulo}`,
    })
    .returning({ id: attachments.id });

  const [firma] = await db
    .insert(budgetSignatures)
    .values({
      tenantId: q.tenantId,
      quoteId: q.id,
      firmanteNombre,
      firmanteRol,
      signatureData,
      signatureSha256: createHash("sha256").update(pngBytes).digest("hex"),
      documentHash,
      ipHash,
      userAgent,
      attachmentId: attachment!.id,
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

  await logAcceso(q.tenantId, q.id, "aceptado", req);

  const res = NextResponse.json({ ok: true, firmaId: firma?.id ?? null });
  res.cookies.delete({
    name: nombreCookiePresupuesto(token),
    path: `/api/publico/presupuesto/${token}`,
  });
  return res;
}
