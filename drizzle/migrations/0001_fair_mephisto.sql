CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venues_location_idx" ON "venues" USING gist ("location");
--> statement-breakpoint
UPDATE "venues" SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography WHERE "location" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL;