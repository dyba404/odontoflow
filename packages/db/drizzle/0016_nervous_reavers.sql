CREATE TABLE "legal_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"razon_social" text,
	"ruc" text,
	"direccion_legal" text,
	"email_contacto_datos" text,
	"telefono_contacto_datos" text,
	"politica_privacidad" text,
	"terminos_uso" text,
	"texto_consentimiento" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_settings" ADD CONSTRAINT "legal_settings_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_settings" ADD CONSTRAINT "legal_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;