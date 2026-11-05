ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_reason" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_meta" jsonb;