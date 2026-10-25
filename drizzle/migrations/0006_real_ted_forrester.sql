ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "league_id" integer;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN ('teams_league_id_leagues_id_fk', 'teams_league_id_fkey')
    ) THEN
        ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_home_team_id_idx" ON "matches" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_guest_team_id_idx" ON "matches" USING btree ("guest_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_league_id_idx" ON "matches" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_kickoff_date_idx" ON "matches" USING btree ("kickoff_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_name_idx" ON "teams" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_short_name_idx" ON "teams" USING btree ("short_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_club_id_idx" ON "teams" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_league_id_idx" ON "teams" USING btree ("league_id");--> statement-breakpoint
UPDATE "teams" t
SET "league_id" = sub.league_id
FROM (
  SELECT home_team_id AS team_id, min(league_id) as league_id FROM matches GROUP BY home_team_id
  UNION
  SELECT guest_team_id AS team_id, min(league_id) as league_id FROM matches GROUP BY guest_team_id
) sub
WHERE t.id = sub.team_id AND t.league_id IS NULL;