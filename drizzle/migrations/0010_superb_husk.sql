ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "submitter_name" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "submitter_role" text;