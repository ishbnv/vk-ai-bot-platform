CREATE TABLE "communities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vk_group_id" bigint NOT NULL,
	"vk_access_token_encrypted" text NOT NULL,
	"vk_callback_secret" text NOT NULL,
	"vk_callback_confirmation_code" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"work_hours_start" smallint DEFAULT 0 NOT NULL,
	"work_hours_end" smallint DEFAULT 24 NOT NULL,
	"nudge_delay_hours" smallint DEFAULT 3 NOT NULL,
	"completion_silence_hours" smallint DEFAULT 24 NOT NULL,
	"forbidden_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active_model" text DEFAULT 'google/gemini-2.5-pro' NOT NULL,
	"ab_test_enabled" boolean DEFAULT false NOT NULL,
	"ab_test_split" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"context_window_messages" smallint DEFAULT 10 NOT NULL,
	"context_token_limit" integer DEFAULT 4000 NOT NULL,
	"vk_photos_enabled" boolean DEFAULT false NOT NULL,
	"vk_voice_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dialogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"vk_user_id" bigint NOT NULL,
	"vk_user_first_name" text,
	"vk_user_last_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"bucket_model" text,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"total_tokens_input" integer DEFAULT 0 NOT NULL,
	"total_tokens_output" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"converted_at" timestamp with time zone,
	"conversion_link_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nudge_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"placeholder_key" text NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"utm_source" text DEFAULT '' NOT NULL,
	"utm_medium" text DEFAULT '' NOT NULL,
	"utm_campaign" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialog_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_used" text,
	"tokens_input" integer,
	"tokens_output" integer,
	"cost_usd" numeric(12, 6),
	"latency_ms" integer,
	"link_sent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_hourly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"hour_bucket" timestamp with time zone NOT NULL,
	"model_used" text NOT NULL,
	"dialogs_started" integer DEFAULT 0 NOT NULL,
	"dialogs_converted" integer DEFAULT 0 NOT NULL,
	"dialogs_nudged" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"total_tokens_input" integer DEFAULT 0 NOT NULL,
	"total_tokens_output" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"sum_latency_ms" bigint DEFAULT 0 NOT NULL,
	"count_latency_samples" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_prices" (
	"model" text PRIMARY KEY NOT NULL,
	"prompt_price_per_1m" numeric(10, 4) NOT NULL,
	"completion_price_per_1m" numeric(10, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vk_events_processed" (
	"event_id" text PRIMARY KEY NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dialogs" ADD CONSTRAINT "dialogs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialogs" ADD CONSTRAINT "dialogs_conversion_link_id_landing_links_id_fk" FOREIGN KEY ("conversion_link_id") REFERENCES "public"."landing_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_links" ADD CONSTRAINT "landing_links_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_dialog_id_dialogs_id_fk" FOREIGN KEY ("dialog_id") REFERENCES "public"."dialogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_link_sent_id_landing_links_id_fk" FOREIGN KEY ("link_sent_id") REFERENCES "public"."landing_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_hourly" ADD CONSTRAINT "metrics_hourly_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "communities_vk_group_id_uq" ON "communities" USING btree ("vk_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dialogs_community_user_uq" ON "dialogs" USING btree ("community_id","vk_user_id");--> statement-breakpoint
CREATE INDEX "dialogs_community_status_idx" ON "dialogs" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX "dialogs_community_last_message_idx" ON "dialogs" USING btree ("community_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "landing_links_community_key_uq" ON "landing_links" USING btree ("community_id","placeholder_key");--> statement-breakpoint
CREATE INDEX "messages_dialog_created_idx" ON "messages" USING btree ("dialog_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_hourly_bucket_model_uq" ON "metrics_hourly" USING btree ("community_id","hour_bucket","model_used");--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_community_version_uq" ON "prompts" USING btree ("community_id","version");--> statement-breakpoint
CREATE INDEX "prompts_community_active_idx" ON "prompts" USING btree ("community_id","is_active");--> statement-breakpoint
CREATE INDEX "vk_events_processed_at_idx" ON "vk_events_processed" USING btree ("processed_at");