import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type OdontoflowDb = ReturnType<typeof buildDb>;

function buildDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no definido (ver .env.local.example)");
  const client = postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return drizzle(client, { schema });
}

declare global {
  // eslint-disable-next-line no-var
  var __odontoflowDb: OdontoflowDb | undefined;
}

export function getDb(): OdontoflowDb {
  if (!globalThis.__odontoflowDb) {
    globalThis.__odontoflowDb = buildDb();
  }
  return globalThis.__odontoflowDb;
}
