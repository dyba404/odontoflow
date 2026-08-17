CREATE TYPE "public"."tooth_state" AS ENUM('sano', 'cariado', 'tratado', 'extraido', 'corona', 'ausente');--> statement-breakpoint
CREATE TABLE "cash_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"apertura" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cierre_real" numeric(10, 2) NOT NULL,
	"cierre_sistema" numeric(10, 2) NOT NULL,
	"diferencia" numeric(10, 2) NOT NULL,
	"cerrado_por" uuid,
	"estado" text DEFAULT 'cerrado' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_closures_tenant_fecha_key" UNIQUE("tenant_id","fecha")
);
--> statement-breakpoint
CREATE TABLE "tooth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"tooth_fdi" integer NOT NULL,
	"estado" "tooth_state" DEFAULT 'sano' NOT NULL,
	"nota" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tooth_states_patient_tooth_key" UNIQUE("patient_id","tooth_fdi")
);
--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_closures" ADD CONSTRAINT "cash_closures_cerrado_por_users_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tooth_states" ADD CONSTRAINT "tooth_states_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tooth_states" ADD CONSTRAINT "tooth_states_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_closures_tenant_idx" ON "cash_closures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tooth_states_patient_idx" ON "tooth_states" USING btree ("patient_id");