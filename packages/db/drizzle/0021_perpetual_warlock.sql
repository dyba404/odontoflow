CREATE TABLE "perio_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"chart_id" uuid,
	"snapshot" jsonb,
	"nota" text,
	"saved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perio_records" ADD CONSTRAINT "perio_records_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perio_records" ADD CONSTRAINT "perio_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perio_records" ADD CONSTRAINT "perio_records_chart_id_odontogram_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."odontogram_charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perio_records" ADD CONSTRAINT "perio_records_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "perio_records_patient_idx" ON "perio_records" USING btree ("patient_id");