ALTER TABLE "teams" ADD COLUMN "league_id" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_home_team_id_idx" ON "matches" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "matches_guest_team_id_idx" ON "matches" USING btree ("guest_team_id");--> statement-breakpoint
CREATE INDEX "matches_league_id_idx" ON "matches" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "matches_kickoff_date_idx" ON "matches" USING btree ("kickoff_date");--> statement-breakpoint
CREATE INDEX "teams_name_idx" ON "teams" USING btree ("name");--> statement-breakpoint
CREATE INDEX "teams_short_name_idx" ON "teams" USING btree ("short_name");--> statement-breakpoint
CREATE INDEX "teams_club_id_idx" ON "teams" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "teams_league_id_idx" ON "teams" USING btree ("league_id");--> statement-breakpoint
UPDATE "teams" t
SET "league_id" = sub.league_id
FROM (
  SELECT home_team_id AS team_id, min(league_id) as league_id FROM matches GROUP BY home_team_id
  UNION
  SELECT guest_team_id AS team_id, min(league_id) as league_id FROM matches GROUP BY guest_team_id
) sub
WHERE t.id = sub.team_id AND t.league_id IS NULL;