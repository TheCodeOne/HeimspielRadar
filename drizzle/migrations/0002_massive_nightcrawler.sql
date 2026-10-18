CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "sk_name" text;
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "ak_name" text;
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN IF NOT EXISTS "geschlecht" text;
--> statement-breakpoint
UPDATE "leagues"
SET
	"sk_name" = COALESCE("sk_name", "raw_data"->>'skName'),
	"ak_name" = COALESCE("ak_name", "raw_data"->>'akName'),
	"geschlecht" = COALESCE("geschlecht", "raw_data"->>'geschlecht')
WHERE "raw_data" IS NOT NULL;