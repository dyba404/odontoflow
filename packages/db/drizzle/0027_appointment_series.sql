CREATE TYPE "public"."appointment_series_status" AS ENUM('activa', 'completada', 'cancelada');--> statement-breakpoint
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
CREATE INDEX "appointment_series_patient_idx" ON "appointment_series" USING btree ("patient_id");