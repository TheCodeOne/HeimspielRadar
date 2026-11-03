CREATE TABLE "venue_submissions" (
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
ALTER TABLE "matches" ADD COLUMN "admission_fee" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "match_notes" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "featured_until" timestamp;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "kiosk_description" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "parking_notes" text;--> statement-breakpoint
ALTER TABLE "venue_submissions" ADD CONSTRAINT "venue_submissions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_submissions" ADD CONSTRAINT "venue_submissions_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;