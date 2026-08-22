ALTER TABLE "patients" ADD COLUMN "codigo_referido" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "referido_por" uuid;--> statement-breakpoint
CREATE INDEX "patients_tenant_codigo_referido_idx" ON "patients" USING btree ("tenant_id","codigo_referido");