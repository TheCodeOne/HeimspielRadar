CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"sync_type" text NOT NULL,
	"target" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"total_leagues" integer DEFAULT 0 NOT NULL,
	"successful_leagues" integer DEFAULT 0 NOT NULL,
	"synced_matches" integer DEFAULT 0 NOT NULL,
	"geocoded_venues" integer DEFAULT 0 NOT NULL,
	"failures_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
