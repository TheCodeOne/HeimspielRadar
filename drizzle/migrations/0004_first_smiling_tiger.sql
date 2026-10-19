CREATE TABLE "sync_failures" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"dbb_league_id" integer NOT NULL,
	"league_name" text,
	"dbb_match_id" integer,
	"verband_id" integer,
	"error_message" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"failed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
