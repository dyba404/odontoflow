CREATE TABLE "budget_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_signatures" DROP COLUMN "ip";--> statement-breakpoint
ALTER TABLE "budget_signatures" ADD COLUMN "document_hash" text;--> statement-breakpoint
ALTER TABLE "budget_signatures" ADD COLUMN "ip_hash" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "link_fail_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "link_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget_access_logs" ADD CONSTRAINT "budget_access_logs_tenant_id_teams_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_access_logs" ADD CONSTRAINT "budget_access_logs_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_access_logs_quote_idx" ON "budget_access_logs" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "budget_access_logs_created_idx" ON "budget_access_logs" USING btree ("created_at");