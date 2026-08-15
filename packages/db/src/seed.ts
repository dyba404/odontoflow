import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(here, "../../../.env.local");
if (!process.env.DATABASE_URL && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1]) process.env[m[1]] = m[2] ?? "";
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no definido");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

async function waitForDb(retries = 10): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await client`select 1`;
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Postgres no respondió luego de varios intentos");
}

async function main() {
  await waitForDb();
  const existing = await db.select({ id: schema.teams.id }).from(schema.teams).limit(1);
  if (existing.length > 0) {
    console.log("Seed ya aplicado (team existe), saltando.");
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(schema.users).values([
      { name: "Dra. Ana García", email: "owner@demo.odontoflow.pe" },
      { name: "Carlos Reception", email: "recepcion@demo.odontoflow.pe" },
      { name: "Dr. Luis Pérez", email: "doctor@demo.odontoflow.pe" },
    ]);

    const team = (await tx
      .insert(schema.teams)
      .values({
        name: "Clínica Dental Sonrisa",
        slug: "sonrisa-demo",
        timezone: "America/Lima",
        bookingMode: "solicitud",
      })
      .returning())[0]!;

    await tx
      .insert(schema.subscriptions)
      .values({ tenantId: team.id, plan: "pro", estado: "activo" });

    const allUsers = await tx.select().from(schema.users);
    const ownerRow = allUsers.find((u) => u.email === "owner@demo.odontoflow.pe")!;
    const recepRow = allUsers.find((u) => u.email === "recepcion@demo.odontoflow.pe")!;
    const doctorRow = allUsers.find((u) => u.email === "doctor@demo.odontoflow.pe")!;

    const members = await tx
      .insert(schema.memberships)
      .values([
        { teamId: team.id, userId: ownerRow.id, role: "owner" },
        { teamId: team.id, userId: recepRow.id, role: "receptionist" },
        { teamId: team.id, userId: doctorRow.id, role: "doctor" },
      ])
      .returning();
    const doctorMembership = members[2]!;

    const scheduleDays = [1, 2, 3, 4, 5];
    const scheduleValues = scheduleDays.flatMap((dow) => [
      { membershipId: doctorMembership.id, dayOfWeek: dow, horaIni: "08:00", horaFin: "13:00" },
      { membershipId: doctorMembership.id, dayOfWeek: dow, horaIni: "14:00", horaFin: "19:00" },
    ]);
    await tx.insert(schema.staffSchedules).values(scheduleValues);

    await tx.insert(schema.services).values([
      {
        tenantId: team.id,
        nombre: "Limpieza dental",
        duracionMin: 30,
        precio: "80.00",
        bufferMin: 5,
      },
      {
        tenantId: team.id,
        nombre: "Resina / empaste",
        duracionMin: 45,
        precio: "150.00",
        bufferMin: 10,
      },
      {
        tenantId: team.id,
        nombre: "Extracción simple",
        duracionMin: 40,
        precio: "120.00",
        bufferMin: 15,
      },
      {
        tenantId: team.id,
        nombre: "Endodoncia (1ra sesión)",
        duracionMin: 60,
        precio: "250.00",
        bufferMin: 15,
      },
    ]);

    console.log("Seed aplicado OK:");
    console.log("  Team:", team.slug, "| Owner:", ownerRow.name);
    console.log("  Usuarios: owner@ / recepcion@ / doctor@ demo.odontoflow.pe (sin password aún)");
  });

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
