CREATE TABLE "offer_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"order_index" smallint NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dialogs" ADD COLUMN "packs_sent_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "offer_packs" ADD CONSTRAINT "offer_packs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "offer_packs_community_order_uq" ON "offer_packs" USING btree ("community_id","order_index");--> statement-breakpoint
CREATE INDEX "offer_packs_community_idx" ON "offer_packs" USING btree ("community_id","order_index");