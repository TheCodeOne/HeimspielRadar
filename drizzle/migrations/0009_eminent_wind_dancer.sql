ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "kiosk_description" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "parking_notes" text;--> statement-breakpoint
ALTER TABLE "venue_submissions" ADD COLUMN IF NOT EXISTS "scope" text DEFAULT 'matchday' NOT NULL;