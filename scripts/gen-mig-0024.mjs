import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const metaDir = join(here, "../packages/db/drizzle/meta");
const drizzleDir = join(here, "../packages/db/drizzle");

const TAG = "0024_soft_mother_askani";

const snap = JSON.parse(readFileSync(join(metaDir, "0023_snapshot.json"), "utf8"));

snap.tables["public.services"].columns.instrucciones_pre = {
  name: "instrucciones_pre",
  type: "text",
  primaryKey: false,
  notNull: false,
};
snap.tables["public.services"].columns.instrucciones_post = {
  name: "instrucciones_post",
  type: "text",
  primaryKey: false,
  notNull: false,
};

snap.prevId = snap.id;
snap.id = randomUUID();

writeFileSync(join(metaDir, "0024_snapshot.json"), JSON.stringify(snap, null, 2));

const sql = `ALTER TABLE "services" ADD COLUMN "instrucciones_pre" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "instrucciones_post" text;`;

writeFileSync(join(drizzleDir, `${TAG}.sql`), sql);

const journal = JSON.parse(readFileSync(join(metaDir, "_journal.json"), "utf8"));
journal.entries.push({
  idx: 24,
  version: "7",
  when: Date.now(),
  tag: TAG,
  breakpoints: true,
});
writeFileSync(join(metaDir, "_journal.json"), JSON.stringify(journal, null, 2));

console.log("ok", TAG, snap.id);
