ALTER TYPE "public"."reminder_type" ADD VALUE 'waitlist';--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "resena_automatica" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "recall_auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD COLUMN "digest_diario" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vat_settings" ADD COLUMN "emision_auto" boolean DEFAULT false NOT NULL;