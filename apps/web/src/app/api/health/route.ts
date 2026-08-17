import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@odontoflow/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const ts = new Date().toISOString();
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    return NextResponse.json({ ok: true, db: true, version: "1.0.0", ts });
  } catch {
    return NextResponse.json({ ok: false, db: false, version: "1.0.0", ts }, { status: 503 });
  }
}
