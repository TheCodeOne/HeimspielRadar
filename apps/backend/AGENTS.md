# Sundayleague Backend & Scraper Guide

This document is the primary reference for AI agents working on the Sundayleague backend, scrapers, and database.

---

## 1. System Overview & Architecture

Sundayleague is a platform for finding amateur sports matches nearby on any given date via a map interface.

- **Framework:** NestJS (inside an Nx Monorepo at `apps/backend`)
- **Shared Types:** `@sundayleague/shared-types` at `libs/shared-types`
- **Database & ORM:** PostgreSQL on [Neon](https://neon.tech) via **Drizzle ORM** (`apps/backend/src/app/database/`)
- **Environment:** `.env.local` and `.env` are automatically merged in both NestJS and `drizzle.config.ts` (`.env.local` takes precedence)
- **Current Core Modules:**
  - `DatabaseModule`: Global Drizzle ORM provider (`DRIZZLE_DB`) with resilient `raw_data jsonb` columns
  - `ScraperModule`: DBB REST client, OSM Nominatim Geocoder, and sync orchestration (`/api/scraper`)
  - `MatchesModule`: Spatial proximity match queries using Haversine formula & date filtering (`/api/matches`)

---

## 2. Current Implementation State (Basketball PoC)

- **Source API:** `https://www.basketball-bund.net` (DBB REST API, unauthenticated JSON)
- **Tested Slice:** Liga `53941` (*BBW3 Kreisliga A 1 Männer*)
- **Scraper Path Caveat:** Venue details (`spielfeld`) are nested under `data.matchInfo.spielfeld` in `GET /rest/match/id/:matchId/matchInfo`.
- **Geocoding:** OpenStreetMap Nominatim with strict database caching per `venue.id` (`spielfeld.id`) so every venue is geocoded only once.

---

## 3. Roadmap & Next Steps

When extending this codebase, follow these planned evolution steps:

### A. Database Evolution & Migrations
1. **Transition from `db:push` to Versioned Migrations:**
   - Currently, prototype schema changes use `drizzle-kit push`.
   - **Next Step:** Switch to deterministic migration files:
     - Run `npx drizzle-kit generate` to generate versioned SQL files into `./drizzle`.
     - Create a migration runner on startup or via an npm script (`drizzle-kit migrate`) for production/CI.
2. **Native PostGIS Geography:**
   - Currently, venues store `latitude` and `longitude` as double precision floats, and spatial filtering runs via TypeScript Haversine calculation.
   - **Next Step:** Introduce a `geography(Point, 4326)` column with a GiST spatial index, enabling native `ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_meters)` queries directly in SQL.

### B. Multi-Sport Support (e.g. Volleyball)
1. **Sport Abstraction in Schema:**
   - Add a `sport` discriminator to `leagues` (`basketball`, `volleyball`, etc.).
   - Generalize external IDs from `dbb_id` to `source` (e.g., `'dbb'`, `'sams_volleyball'`) + `external_id`.
2. **Pluggable Scraper Interface:**
   - Define a generic interface in `libs/shared-types` or `apps/backend/src/app/scraper/`:
     ```typescript
     export interface SportScraper {
       readonly sport: string;
       syncLeague(externalLeagueId: string | number): Promise<SyncResult>;
       discoverLeagues(regionId?: string | number): Promise<League[]>;
     }
     ```
3. **Volleyball Data Integration:**
   - German Volleyball leagues primarily use the **SAMS** system (e.g., `sams-score.de` / DVV Landesverbände).
   - Implement `SamsClientService` under `apps/backend/src/app/scraper/volleyball/` following the same pattern as `dbb-client.service.ts`.

### C. Scaling the Basketball Scraper
1. **Full Baden-Württemberg Coverage (~280 Leagues):**
   - Use `fetchWamLeagues(verbandId = 1, startAtIndex)` to page through all leagues across the 4 Bezirke (Nordwürttemberg, Schwarzwald/Oberrhein, Rhein/Neckar, etc.).
   - Provide an endpoint `POST /api/scraper/sync/verband/1` with concurrency limiting to avoid overwhelming upstream APIs.
2. **Automated & Incremental Sync (Cron / Jobs):**
   - Add `@nestjs/schedule` or Neon Function Triggers for periodic syncs.
   - Differentiate between:
     - **Full Season Sync:** Run weekly/monthly to catch rescheduled dates/venues.
     - **Live/Weekend Sync:** Run on Saturdays and Sundays to update match results and scores (`result`, `confirmed`).

---

## 4. Key Commands

```bash
# Start backend in development
npm run start:backend

# Build backend
npm run build:backend

# Push schema changes to Neon DB (prototype mode)
npm run db:push

# Open Drizzle Studio to inspect DB rows visually
npm run db:studio

# Trigger manual sync of basketball league 53941
curl -X POST http://localhost:3000/api/scraper/sync/53941

# Query matches within 25 km on a given date
curl "http://localhost:3000/api/matches?date=2026-09-26&lat=48.87&lng=9.27&radiusKm=25"
```
