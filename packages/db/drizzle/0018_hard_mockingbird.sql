CREATE TABLE "infra_backups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"size_bytes" bigint,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "infra_backups_kind_created_idx" ON "infra_backups" USING btree ("kind","created_at");