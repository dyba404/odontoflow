import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema.js";
import { FOUNDER_NAME_DEV } from "./fundador.js";

// Crea o RE-ESTABLECE al fundador con la contrasena que llegue por env.
// La suite E2E de admin lo usa para arrancar siempre con password temporal y
// must_change_password=true; el seed de dev (seed.ts) usa el upsert de
// fundador.js que solo crea (no pisa una contrasena ya rotada).
const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido");

const email = (process.env.FOUNDER_EMAIL ?? "").trim().toLowerCase();
const password = process.env.FOUNDER_PASSWORD ?? "";
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("FOUNDER_EMAIL no definido o invalido (variable de entorno).");
  process.exit(1);
}
if (password.length < 8) {
  console.error("FOUNDER_PASSWORD debe tener al menos 8 caracteres (variable de entorno).");
  process.exit(1);
}

function hashPassword(p: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(p, salt, 64);
  return `scrypt:${salt}:${Buffer.from(key).toString("hex")}`;
}

async function main() {
  const client = postgres(urlEnv as string, { max: 1, connect_timeout: 10, ssl: false, idle_timeout: 5 });
  try {
    const db = drizzle(client, { schema });
    const [existente] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existente) {
      await db
        .update(schema.users)
        .set({
          passwordHash: hashPassword(password),
          isPlatformAdmin: true,
          mustChangePassword: true,
          lockedAt: null,
          lockedReason: null,
        })
        .where(eq(schema.users.id, existente.id));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, existente.id));
      console.log(`Fundador re-establecido: ${email} (contrasena temporal, debe cambiarla).`);
    } else {
      await db.insert(schema.users).values({
        name: process.env.FOUNDER_NAME ?? FOUNDER_NAME_DEV,
        email,
        passwordHash: hashPassword(password),
        isPlatformAdmin: true,
        mustChangePassword: true,
      });
      console.log(`Fundador creado: ${email} (debe cambiar la contrasena en el primer login).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
