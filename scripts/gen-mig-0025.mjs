import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const metaDir = join(here, "../packages/db/drizzle/meta");
const drizzleDir = join(here, "../packages/db/drizzle");

const TAG = "0025_patient_representante";

const snap = JSON.parse(readFileSync(join(metaDir, "0024_snapshot.json"), "utf8"));

snap.tables["public.patients"].columns.representante_id = {
  name: "representante_id",
  type: "uuid",
  primaryKey: false,
  notNull: false,
};

snap.prevId = snap.id;
snap.id = randomUUID();

writeFileSync(join(metaDir, "0025_snapshot.json"), JSON.stringify(snap, null, 2));

const sql = `ALTER TABLE "patients" ADD COLUMN "representante_id" uuid;`;

writeFileSync(join(drizzleDir, `${TAG}.sql`), sql);

const journal = JSON.parse(readFileSync(join(metaDir, "_journal.json"), "utf8"));
journal.entries.push({
  idx: 25,
  version: "7",
  when: Date.now(),
  tag: TAG,
  breakpoints: true,
});
writeFileSync(join(metaDir, "_journal.json"), JSON.stringify(journal, null, 2));

console.log("ok", TAG, snap.id);
