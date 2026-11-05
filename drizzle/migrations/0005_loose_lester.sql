ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "is_venue_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "primary_venue_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_primary_venue_id_venues_id_fk" FOREIGN KEY ("primary_venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;