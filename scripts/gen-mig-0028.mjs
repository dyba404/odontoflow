import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const metaDir = join(here, "../packages/db/drizzle/meta");
const drizzleDir = join(here, "../packages/db/drizzle");

const TAG = "0028_referidos";

const snap = JSON.parse(readFileSync(join(metaDir, "0027_snapshot.json"), "utf8"));

snap.tables["public.patients"].columns.codigo_referido = {
  name: "codigo_referido",
  type: "text",
  primaryKey: false,
  notNull: false,
};
snap.tables["public.patients"].columns.referido_por = {
  name: "referido_por",
  type: "uuid",
  primaryKey: false,
  notNull: false,
};

snap.prevId = snap.id;
snap.id = randomUUID();

writeFileSync(join(metaDir, "0028_snapshot.json"), JSON.stringify(snap, null, 2));

const sql = `ALTER TABLE "patients" ADD COLUMN "codigo_referido" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referido_por" uuid;--> statement-breakpoint
CREATE INDEX "patients_tenant_codigo_referido_idx" ON "patients" USING btree ("tenant_id","codigo_referido");`;

writeFileSync(join(drizzleDir, `${TAG}.sql`), sql);

const journal = JSON.parse(readFileSync(join(metaDir, "_journal.json"), "utf8"));
journal.entries.push({
  idx: 28,
  version: "7",
  when: Date.now(),
  tag: TAG,
  breakpoints: true,
});
writeFileSync(join(metaDir, "_journal.json"), JSON.stringify(journal, null, 2));

console.log("ok", TAG, snap.id);
