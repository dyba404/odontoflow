CREATE TYPE "public"."allocation_kind" AS ENUM('allocation', 'refund');--> statement-breakpoint
CREATE TYPE "public"."budget_accepted_via" AS ENUM('link_publico', 'clinica', 'manual');--> statement-breakpoint
CREATE TYPE "public"."budget_closure_reason" AS ENUM('precio', 'tiempo', 'segunda_opinion', 'otro');--> statement-breakpoint
CREATE TYPE "public"."sala_status" AS ENUM('anunciado', 'en_box', 'en_espera_pago', 'atendido', 'retirado');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_item_status" AS ENUM('pending', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_session_status" AS ENUM('programada', 'realizada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."treatment_plan_status" AS ENUM('draft', 'pending', 'active', 'completed', 'archived', 'closed');--> statement-breakpoint
CREATE TABLE "appointment_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"estado_from" "appointment_status",
	"estado_to" "appointment_status" NOT NULL,
	"changed_by" uuid,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"firmante_nombre" text NOT NULL,
	"firmante_rol" text DEFAULT 'paciente' NOT NULL,
	"signature_data" text NOT NULL,
	"signature_sha256" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"attachment_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template_id" uuid,
	"tratamiento" text,
	"contenido_snap" text NOT NULL,
	"firmante_nombre" text NOT NULL,
	"firmante_rol" text DEFAULT 'paciente' NOT NULL,
	"signature_data" text,
	"signature_sha256" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"registrado_por" uuid,
	"attachment_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tratamiento" text,
	"contenido" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_templates_tenant_nombre_key" UNIQUE("tenant_id","nombre")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"quote_id" uuid,
	"monto" numeric(10, 2) NOT NULL,
	"kind" "allocation_kind" DEFAULT 'allocation' NOT NULL,
	"concepto" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"secuencia" integer DEFAULT 1 NOT NULL,
	"estado" "treatment_plan_item_status" DEFAULT 'pending' NOT NULL,
	"snapshot_servicio" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"session_n" integer DEFAULT 1 NOT NULL,
	"appointment_id" uuid,
	"estado" "treatment_plan_session_status" DEFAULT 'programada' NOT NULL,
	"realizada_at" timestamp with time zone,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"plan_number" text NOT NULL,
	"estado" "treatment_plan_status" DEFAULT 'draft' NOT NULL,
	"closure_reason" text,
	"titulo" text NOT NULL,
	"budget_id" uuid,
	"assigned_doctor_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treatment_plans_tenant_plan_number_key" UNIQUE("tenant_id","plan_number")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "sala_estado" "sala_status";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "current_status_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "room" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "denegado_motivo" "budget_closure_reason";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_via" "budget_accepted_via";--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "parent_budget_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "link_token" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "link_two_factor" jsonb;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_status_events" ADD CONSTRAINT "appointment_status_events_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_signatures" ADD CONSTRAINT "budget_signatures_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_signatures" ADD CONSTRAINT "budget_signatures_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_signatures" ADD CONSTRAINT "budget_signatures_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_template_id_consent_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."consent_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_signs" ADD CONSTRAINT "consent_signs_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_plan_id_treatment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."treatment_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_items" ADD CONSTRAINT "treatment_plan_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_item_id_treatment_plan_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."treatment_plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plan_sessions" ADD CONSTRAINT "treatment_plan_sessions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_budget_id_quotes_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_assigned_doctor_id_memberships_id_fk" FOREIGN KEY ("assigned_doctor_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_status_events_cita_idx" ON "appointment_status_events" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_status_events_tenant_idx" ON "appointment_status_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "budget_signatures_quote_idx" ON "budget_signatures" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "consent_signs_patient_idx" ON "consent_signs" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "consent_signs_tenant_idx" ON "consent_signs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "consent_templates_tenant_idx" ON "consent_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_quote_idx" ON "payment_allocations" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_patient_idx" ON "payment_allocations" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_tenant_idx" ON "payment_allocations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_items_plan_idx" ON "treatment_plan_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_items_tenant_idx" ON "treatment_plan_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_sessions_item_idx" ON "treatment_plan_sessions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "treatment_plan_sessions_tenant_idx" ON "treatment_plan_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "treatment_plans_patient_idx" ON "treatment_plans" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "treatment_plans_tenant_idx" ON "treatment_plans" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_parent_budget_id_quotes_id_fk" FOREIGN KEY ("parent_budget_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;