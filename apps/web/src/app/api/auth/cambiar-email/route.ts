import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@odontoflow/db";
import {
  getSession,
  getPlatformSession,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, ipReq } from "@/lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const limite = rateLimit(`cambiar_email:${ipReq(req)}`, 5);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "demasiadas_solicitudes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limite.retryAfterMs / 1000)) } },
    );
  }

  const staff = await getSession();
  const platform = staff ? null : await getPlatformSession();
  const sesion = staff ?? platform;
  if (!sesion) {
    return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  }

  let body: { nuevo?: string; contrasena?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const nuevo = (body.nuevo ?? "").trim().toLowerCase();
  const contrasena = body.contrasena ?? "";
  if (!EMAIL_RE.test(nuevo) || !contrasena) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, sesion.userId)).limit(1);
  if (!user?.passwordHash || !(await verifyPassword(contrasena, user.passwordHash))) {
    return NextResponse.json({ error: "contraseña_actual_invalida" }, { status: 401 });
  }
  if (user.email === nuevo) {
    return NextResponse.json({ error: "email_igual" }, { status: 400 });
  }

  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, nuevo))
    .limit(1);
  if (existente && existente.id !== user.id) {
    return NextResponse.json({ error: "email_ya_registrado" }, { status: 409 });
  }

  await db.update(users).set({ email: nuevo }).where(eq(users.id, user.id));

  return NextResponse.json({ ok: true, email: nuevo });
}
