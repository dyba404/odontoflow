CREATE TYPE "public"."campaign_status" AS ENUM('programada', 'completada', 'error');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('cumple', 'reactivacion');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('pendiente', 'parcial', 'pagada', 'vencida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."lab_order_status" AS ENUM('enviado', 'fabricacion', 'recibido', 'colocado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('borrador', 'enviado', 'aprobado', 'rechazado', 'convertido');--> statement-breakpoint
CREATE TYPE "public"."receipt_sunat_estado" AS ENUM('manual', 'pendiente_envio', 'aceptado', 'rechazado', 'baja');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('ingreso', 'consumo', 'ajuste', 'merma');--> statement-breakpoint
CREATE TYPE "public"."vat_emision" AS ENUM('manual', 'electronica');--> statement-breakpoint
CREATE TYPE "public"."vat_regimen" AS ENUM('RUS', 'RER', 'MYPE');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('activa', 'ofrecida', 'aceptada', 'expirada', 'retirada');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"direccion" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_tenant_slug_key" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tipo" "campaign_type" NOT NULL,
	"titulo" text NOT NULL,
	"mensaje" text NOT NULL,
	"canal" text DEFAULT 'email' NOT NULL,
	"estado" "campaign_status" DEFAULT 'programada' NOT NULL,
	"audiencia" jsonb DEFAULT '[]' NOT NULL,
	"enviado_a" integer DEFAULT 0 NOT NULL,
	"enviados_ok" integer DEFAULT 0 NOT NULL,
	"ejecutada_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"doctor_membership_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"appointment_id" uuid,
	"base" numeric(10, 2) NOT NULL,
	"porcentaje" numeric(5, 2) NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"periodo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_entries_payment_doctor_key" UNIQUE("payment_id","doctor_membership_id")
);
--> statement-breakpoint
CREATE TABLE "commission_settings" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"porcentaje" numeric(5, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"detalle" text,
	"gestionado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"quote_id" uuid,
	"concepto" text NOT NULL,
	"n" integer DEFAULT 1 NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"pagado" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vence" date,
	"estado" "installment_status" DEFAULT 'pendiente' NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"ruc" text,
	"telefono" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text DEFAULT 'general' NOT NULL,
	"unidad" text DEFAULT 'und' NOT NULL,
	"stock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"stock_min" numeric(12, 2) DEFAULT '1' NOT NULL,
	"costo_unit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"lote" text NOT NULL,
	"vence" date,
	"cantidad" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"appointment_id" uuid,
	"tipo" text NOT NULL,
	"laboratorio" text,
	"fecha_promesa" date,
	"costo" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" "lab_order_status" DEFAULT 'enviado' NOT NULL,
	"notas" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_coverages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"insurer_id" uuid NOT NULL,
	"plan" text,
	"copago_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"vigente_desde" date,
	"vigente_hasta" date,
	"activo" boolean DEFAULT true NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid,
	"titulo" text NOT NULL,
	"items" jsonb NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" "quote_status" DEFAULT 'borrador' NOT NULL,
	"expira_en" date,
	"nota" text,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid,
	"patient_id" uuid NOT NULL,
	"canal" text DEFAULT 'email' NOT NULL,
	"enviado_at" timestamp with time zone,
	"respondido" boolean DEFAULT false NOT NULL,
	"respondido_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	CONSTRAINT "service_materials_unique" UNIQUE("service_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"tipo" "stock_movement_type" NOT NULL,
	"cantidad" numeric(12, 2) NOT NULL,
	"appointment_id" uuid,
	"nota" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"ruc" text,
	"razon_social" text,
	"regimen" "vat_regimen" DEFAULT 'RUS' NOT NULL,
	"ambiente" text DEFAULT 'beta' NOT NULL,
	"clave_sol_enc" text,
	"certificado_enc" text,
	"certificado_pass_enc" text,
	"certificado_vence" date,
	"serie_boleta" text DEFAULT 'B001' NOT NULL,
	"serie_factura" text DEFAULT 'F001' NOT NULL,
	"corr_boleta" integer DEFAULT 0 NOT NULL,
	"corr_factura" integer DEFAULT 0 NOT NULL,
	"emision" "vat_emision" DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"service_id" uuid,
	"preferencia" text,
	"prioridad" integer DEFAULT 5 NOT NULL,
	"estado" "waitlist_status" DEFAULT 'activa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"phone_number_id" text,
	"token_enc" text,
	"webhook_verified_at" timestamp with time zone,
	"activo" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "foto_tipo" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "foto_orden" integer;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "tratamiento" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "antecedentes" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "medicacion" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "sunat_estado" "receipt_sunat_estado" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "sunat_hash" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "cdr_url" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "xml_url" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "pdf_url" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "emitida_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "restringir_fuera_horario" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "google_place_id" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "google_review_url" text;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_doctor_membership_id_memberships_id_fk" FOREIGN KEY ("doctor_membership_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_settings" ADD CONSTRAINT "commission_settings_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_gestionado_por_users_id_fk" FOREIGN KEY ("gestionado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurers" ADD CONSTRAINT "insurers_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_coverages" ADD CONSTRAINT "patient_coverages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_coverages" ADD CONSTRAINT "patient_coverages_insurer_id_insurers_id_fk" FOREIGN KEY ("insurer_id") REFERENCES "public"."insurers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_doctor_id_memberships_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."memberships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_inventory_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD CONSTRAINT "vat_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlists" ADD CONSTRAINT "waitlists_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_tenant_idx" ON "branches" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_idx" ON "campaigns" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "commission_entries_tenant_periodo_idx" ON "commission_entries" USING btree ("tenant_id","periodo");--> statement-breakpoint
CREATE INDEX "data_requests_tenant_idx" ON "data_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "installments_patient_idx" ON "installments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "installments_tenant_idx" ON "installments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "insurers_tenant_idx" ON "insurers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_items_tenant_idx" ON "inventory_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_lots_item_idx" ON "inventory_lots" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "lab_orders_patient_idx" ON "lab_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "lab_orders_tenant_idx" ON "lab_orders" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "patient_coverages_patient_idx" ON "patient_coverages" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "quotes_patient_idx" ON "quotes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "quotes_tenant_idx" ON "quotes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_requests_tenant_idx" ON "review_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_item_idx" ON "stock_movements" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_idx" ON "stock_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "waitlists_tenant_estado_idx" ON "waitlists" USING btree ("tenant_id","estado");