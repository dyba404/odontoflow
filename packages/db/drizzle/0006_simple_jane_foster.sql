ALTER TYPE "public"."receipt_sunat_estado" ADD VALUE 'baja_pendiente';--> statement-breakpoint
ALTER TYPE "public"."receipt_sunat_estado" ADD VALUE 'baja_aceptada';--> statement-breakpoint
ALTER TYPE "public"."receipt_sunat_estado" ADD VALUE 'baja_rechazada';--> statement-breakpoint
ALTER TYPE "public"."reminder_type" ADD VALUE 'reprogramacion';--> statement-breakpoint
ALTER TABLE "cash_closures" DROP CONSTRAINT "cash_closures_tenant_fecha_key";--> statement-breakpoint
ALTER TABLE "cash_closures" ADD COLUMN "reabierto_por" uuid;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD COLUMN "reabierto_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD COLUMN "motivo_reapertura" text;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD COLUMN "motivo_revision" text;--> statement-breakpoint
ALTER TABLE "lab_orders" ADD COLUMN "rev" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "plantilla_recordatorio" text DEFAULT 'recordatorio_cita' NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "idioma_plantilla" text DEFAULT 'es' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "estado" text DEFAULT 'valido' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "anulado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "anulado_con_id" uuid;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "baja_ticket" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "baja_enviada_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "baja_motivo" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "emitida_por" uuid;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD COLUMN "corr_nota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD COLUMN "corr_baja" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_emitida_por_users_id_fk" FOREIGN KEY ("emitida_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_closures_tenant_fecha_idx" ON "cash_closures" USING btree ("tenant_id","fecha");