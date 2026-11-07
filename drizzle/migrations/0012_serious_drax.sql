CREATE TABLE "push_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"match_id" integer NOT NULL,
	"lead_time" varchar(8) NOT NULL,
	"reminder_sent_at" timestamp,
	"kickoff_date" varchar(32),
	"kickoff_time" varchar(32),
	"venue_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_reminders" ADD CONSTRAINT "push_reminders_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_reminders" ADD CONSTRAINT "push_reminders_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_reminders_endpoint_match_id_idx" ON "push_reminders" USING btree ("endpoint","match_id");--> statement-breakpoint
CREATE INDEX "push_reminders_match_id_idx" ON "push_reminders" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "push_reminders_reminder_sent_at_idx" ON "push_reminders" USING btree ("reminder_sent_at");