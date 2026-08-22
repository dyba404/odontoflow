import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const metaDir = join(here, "../packages/db/drizzle/meta");
const drizzleDir = join(here, "../packages/db/drizzle");

const TAG = "0027_appointment_series";

const snap = JSON.parse(readFileSync(join(metaDir, "0026_snapshot.json"), "utf8"));

snap.tables["public.appointments"].columns.series_id = {
  name: "series_id",
  type: "uuid",
  primaryKey: false,
  notNull: false,
};
snap.tables["public.appointments"].columns.series_n = {
  name: "series_n",
  type: "integer",
  primaryKey: false,
  notNull: false,
};

snap.enums["public.appointment_series_status"] = {
  name: "appointment_series_status",
  schema: "public",
  values: ["activa", "completada", "cancelada"],
};

snap.tables["public.appointment_series"] = {
  name: "appointment_series",
  schema: "",
  columns: {
    id: { name: "id", type: "uuid", primaryKey: true, notNull: true, default: "gen_random_uuid()" },
    tenant_id: { name: "tenant_id", type: "uuid", primaryKey: false, notNull: true },
    patient_id: { name: "patient_id", type: "uuid", primaryKey: false, notNull: true },
    service_id: { name: "service_id", type: "uuid", primaryKey: false, notNull: true },
    doctor_id: { name: "doctor_id", type: "uuid", primaryKey: false, notNull: false },
    titulo: { name: "titulo", type: "text", primaryKey: false, notNull: true },
    frecuencia: { name: "frecuencia", type: "text", primaryKey: false, notNull: true, default: "'semanal'" },
    hora_ini: { name: "hora_ini", type: "time", primaryKey: false, notNull: true },
    total_sesiones: { name: "total_sesiones", type: "integer", primaryKey: false, notNull: true },
    creadas: { name: "creadas", type: "integer", primaryKey: false, notNull: true, default: 0 },
    omitidas: { name: "omitidas", type: "integer", primaryKey: false, notNull: true, default: 0 },
    estado: { name: "estado", type: "appointment_series_status", typeSchema: "public", primaryKey: false, notNull: true, default: "'activa'" },
    created_by: { name: "created_by", type: "uuid", primaryKey: false, notNull: false },
    created_at: { name: "created_at", type: "timestamp with time zone", primaryKey: false, notNull: true, default: "now()" },
    updated_at: { name: "updated_at", type: "timestamp with time zone", primaryKey: false, notNull: true, default: "now()" },
  },
  indexes: {
    appointment_series_tenant_idx: { name: "appointment_series_tenant_idx", columns: [{ expression: "tenant_id", isExpression: false, asc: true, nulls: "last" }], isUnique: false, concurrently: false, method: "btree", with: {} },
    appointment_series_patient_idx: { name: "appointment_series_patient_idx", columns: [{ expression: "patient_id", isExpression: false, asc: true, nulls: "last" }], isUnique: false, concurrently: false, method: "btree", with: {} },
  },
  foreignKeys: {
    appointment_series_tenant_id_teams_id_fk: { name: "appointment_series_tenant_id_teams_id_fk", tableFrom: "appointment_series", tableTo: "teams", columnsFrom: ["tenant_id"], columnsTo: ["id"], onDelete: "cascade", onUpdate: "no action" },
    appointment_series_patient_id_patients_id_fk: { name: "appointment_series_patient_id_patients_id_fk", tableFrom: "appointment_series", tableTo: "patients", columnsFrom: ["patient_id"], columnsTo: ["id"], onDelete: "cascade", onUpdate: "no action" },
    appointment_series_service_id_services_id_fk: { name: "appointment_series_service_id_services_id_fk", tableFrom: "appointment_series", tableTo: "services", columnsFrom: ["service_id"], columnsTo: ["id"], onDelete: "no action", onUpdate: "no action" },
  },
  compositePrimaryKeys: {},
  uniqueConstraints: {},
  policies: {},
  checkConstraints: {},
  isRLSEnabled: false,
};

snap.prevId = snap.id;
snap.id = randomUUID();

writeFileSync(join(metaDir, "0027_snapshot.json"), JSON.stringify(snap, null, 2));

const sql = `CREATE TYPE "public"."appointment_series_status" AS ENUM('activa', 'completada', 'cancelada');--> statement-breakpoint
CREATE TABLE "appointment_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"doctor_id" uuid,
	"titulo" text NOT NULL,
	"frecuencia" text DEFAULT 'semanal' NOT NULL,
	"hora_ini" time NOT NULL,
	"total_sesiones" integer NOT NULL,
	"creadas" integer DEFAULT 0 NOT NULL,
	"omitidas" integer DEFAULT 0 NOT NULL,
	"estado" "appointment_series_status" DEFAULT 'activa' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_n" integer;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_series" ADD CONSTRAINT "appointment_series_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_series_tenant_idx" ON "appointment_series" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "appointment_series_patient_idx" ON "appointment_series" USING btree ("patient_id");`;

writeFileSync(join(drizzleDir, `${TAG}.sql`), sql);

const journal = JSON.parse(readFileSync(join(metaDir, "_journal.json"), "utf8"));
journal.entries.push({
  idx: 27,
  version: "7",
  when: Date.now(),
  tag: TAG,
  breakpoints: true,
});
writeFileSync(join(metaDir, "_journal.json"), JSON.stringify(journal, null, 2));

console.log("ok", TAG, snap.id);
