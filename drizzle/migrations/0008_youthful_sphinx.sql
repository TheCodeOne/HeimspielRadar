CREATE TABLE IF NOT EXISTS "venue_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer,
	"venue_id" integer,
	"submitter_name" text,
	"submitter_role" text,
	"submitted_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "admission_fee" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "match_notes" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_until" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "kiosk_description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "parking_notes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_submissions" ADD CONSTRAINT "venue_submissions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "venue_submissions" ADD CONSTRAINT "venue_submissions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;