ALTER TABLE "matches" ADD COLUMN "kiosk_description" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "parking_notes" text;--> statement-breakpoint
ALTER TABLE "venue_submissions" ADD COLUMN "scope" text DEFAULT 'matchday' NOT NULL;