CREATE TABLE "odontogram_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" jsonb,
	"plan" jsonb,
	"version" text,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "odontogram_charts_tenant_patient_key" UNIQUE("tenant_id","patient_id")
);
--> statement-breakpoint
CREATE TABLE "odontogram_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"chart_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "odontogram_charts" ADD CONSTRAINT "odontogram_charts_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_charts" ADD CONSTRAINT "odontogram_charts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_charts" ADD CONSTRAINT "odontogram_charts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_chart_id_odontogram_charts_id_fk" FOREIGN KEY ("chart_id") REFERENCES "public"."odontogram_charts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odontogram_history" ADD CONSTRAINT "odontogram_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "odontogram_charts_patient_idx" ON "odontogram_charts" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "odontogram_history_patient_idx" ON "odontogram_history" USING btree ("patient_id");