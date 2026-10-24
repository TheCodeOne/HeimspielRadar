ALTER TABLE "matches" ADD COLUMN "is_venue_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "primary_venue_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_primary_venue_id_venues_id_fk" FOREIGN KEY ("primary_venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;