import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(aqui, "../../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

const urlEnv = process.env.DATABASE_URL;
if (!urlEnv) throw new Error("DATABASE_URL no definido");

const accion = process.argv[2] ?? "";
const slugTenant = process.env.TEAM_SLUG ?? "dental";
const emailFundador = (process.env.FOUNDER_EMAIL ?? "").trim().toLowerCase();
if (!emailFundador) {
  console.error("FOUNDER_EMAIL no definido (variable de entorno).");
  process.exit(1);
}
if (accion !== "crear" && accion !== "borrar") {
  console.error("Uso: tsx src/membresia-fundador-e2e.ts crear|borrar");
  process.exit(1);
}

async function main() {
  const client = postgres(urlEnv as string, { max: 1, connect_timeout: 10, ssl: false, idle_timeout: 5 });
  try {
    const db = drizzle(client, { schema });

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, emailFundador))
      .limit(1);
    if (!user) {
      console.error(`Fundador no encontrado: ${emailFundador}`);
      process.exit(1);
    }
    const [team] = await db
      .select({ id: schema.teams.id })
      .from(schema.teams)
      .where(eq(schema.teams.slug, slugTenant))
      .limit(1);
    if (!team) {
      console.error(`Tenant no encontrado: ${slugTenant}`);
      process.exit(1);
    }

    if (accion === "crear") {
      await db
        .insert(schema.memberships)
        .values({ teamId: team.id, userId: user.id, role: "owner", active: true })
        .onConflictDoNothing();
      console.log(`Membresía creada: ${emailFundador} -> ${slugTenant} (owner).`);
      return;
    }

    await db
      .delete(schema.memberships)
      .where(and(eq(schema.memberships.teamId, team.id), eq(schema.memberships.userId, user.id)));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    console.log(`Membresía borrada: ${emailFundador} <- ${slugTenant} (y sus sesiones).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
