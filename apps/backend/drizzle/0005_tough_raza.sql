ALTER TABLE "communities" ADD COLUMN "bothunter_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "bothunter_grace_minutes" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "dialogs" ADD COLUMN "last_external_reply_at" timestamp with time zone;