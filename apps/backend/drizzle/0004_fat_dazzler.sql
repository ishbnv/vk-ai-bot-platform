-- Переименовываем колонку и одновременно пересчитываем существующие значения
-- (часы → минуты ×60), чтобы поведение для уже подключённых сообществ не поменялось.
ALTER TABLE "communities" RENAME COLUMN "nudge_delay_hours" TO "nudge_delay_minutes";--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "nudge_delay_minutes" TYPE integer;--> statement-breakpoint
UPDATE "communities" SET "nudge_delay_minutes" = "nudge_delay_minutes" * 60;--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "nudge_delay_minutes" SET DEFAULT 180;
