import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import {
  RetryFailedResult,
  SyncResult,
  VerbandSyncResult,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  leagues,
  matches,
  syncFailures,
  systemSettings,
  teams,
  venues,
} from '../database/schema';
import { DbbClientService, DbbTeam, DbbVenue } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';

export interface SyncLeagueOptions {
  quickSync?: boolean;
  matchConcurrency?: number;
  venueCache?: Map<number, typeof venues.$inferSelect>;
  venueInFlight?: Map<number, Promise<typeof venues.$inferSelect | null>>;
  verbandId?: number;
  leagueName?: string;
}

export interface SyncVerbandOptions {
  quickSync?: boolean;
  concurrency?: number;
  throttleMs?: number;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private lastSyncedAt: Date | null = null;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly dbbClient: DbbClientService,
    private readonly geocoder: GeocoderService
  ) {}

  /**
   * Preview a league's schedule directly from DBB without saving to the database.
   */
  async previewLeague(ligaId: number) {
    const spielplan = await this.dbbClient.fetchSpielplan(ligaId);
    const { ligaData, matches: matchData } = spielplan.data;

    let sampleVenue = null;

    if (matchData.length > 0) {
      try {
        const info = await this.dbbClient.fetchMatchInfo(matchData[0].matchId);
        sampleVenue = info.data?.matchInfo?.spielfeld || null;
      } catch {
        this.logger.debug(`Could not fetch sample venue for match ${matchData[0].matchId}`);
      }
    }

    return {
      league: ligaData,
      totalMatches: matchData.length,
      sampleMatch: matchData[0] || null,
      sampleVenue,
    };
  }

  /**
   * Synchronizes a single league with all its matches, teams, and geocoded venues into the database.
   */
  async syncLeague(ligaId: number, options?: SyncLeagueOptions): Promise<SyncResult> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to persist scraped data.'
      );
    }

    const db = this.db;
    const startTime = Date.now();
    let leagueName = options?.leagueName ?? null;
    let matchErrorsCount = 0;

    this.logger.log(`Starting sync for league ${ligaId}...`);

    try {
      const spielplan = await this.dbbClient.fetchSpielplan(ligaId);
      const { ligaData, matches: rawMatches } = spielplan.data;

      if (!ligaData) {
        throw new Error(`Invalid response from DBB: No league data found for ID ${ligaId}`);
      }

      leagueName = ligaData.liganame;

      // 1. Upsert League
      const [dbLeague] = await db
        .insert(leagues)
        .values({
          dbbId: ligaData.ligaId,
          name: ligaData.liganame,
          seasonId: ligaData.seasonId,
          seasonName: ligaData.seasonName,
          verbandName: ligaData.verbandName || 'Baden-Württemberg',
          skName: ligaData.skName || null,
          akName: ligaData.akName || null,
          geschlecht: ligaData.geschlecht || null,
          rawData: ligaData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: leagues.dbbId,
          set: {
            name: ligaData.liganame,
            seasonName: ligaData.seasonName,
            skName: ligaData.skName || null,
            akName: ligaData.akName || null,
            geschlecht: ligaData.geschlecht || null,
            rawData: ligaData,
            updatedAt: new Date(),
          },
        })
        .returning();

      // 2. Collect & Batch Upsert Teams
      const teamMap = new Map<
        number,
        { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }
      >();

      for (const m of rawMatches) {
        this.collectTeam(m.homeTeam, teamMap);
        this.collectTeam(m.guestTeam, teamMap);
      }

      const teamDbIdMap = new Map<number, number>(); // dbbId -> internal team.id

      const teamValues = Array.from(teamMap.values()).map((t) => ({
        dbbId: t.dbbId,
        name: t.name,
        shortName: t.shortName,
        clubId: t.clubId,
        rawData: t.raw,
      }));

      if (teamValues.length > 0) {
        const upsertedTeams = await db
          .insert(teams)
          .values(teamValues)
          .onConflictDoUpdate({
            target: teams.dbbId,
            set: {
              name: sql`excluded.name`,
              shortName: sql`excluded.short_name`,
              clubId: sql`excluded.club_id`,
              rawData: sql`excluded.raw_data`,
            },
          })
          .returning();

        for (let i = 0; i < teamValues.length; i++) {
          const upserted = upsertedTeams[i] ?? upsertedTeams[0];

          if (upserted) {
            const dbbId = upserted.dbbId ?? teamValues[i].dbbId;
            teamDbIdMap.set(dbbId, upserted.id);
          }
        }
      }

      // 3. Preload Existing Matches for this League to detect known venues and finished results
      const existingLeagueMatches = await db
        .select({
          id: matches.id,
          venueId: matches.venueId,
          result: matches.result,
        })
        .from(matches)
        .where(eq(matches.leagueId, dbLeague.id));

      const existingMatchMap = new Map<
        number,
        { venueId: number | null; result: string | null }
      >();

      for (const em of existingLeagueMatches) {
        existingMatchMap.set(em.id, {
          venueId: em.venueId,
          result: em.result ?? null,
        });
      }

      // 4. Sync Matches and Venues (Gyms) with Bounded Intra-League Concurrency
      let geocodedVenuesCount = 0;
      let syncedVenuesCount = 0;
      let syncedMatchesCount = 0;

      let venueCache = options?.venueCache;

      if (!venueCache) {
        const existingVenues = await db.select().from(venues);
        venueCache = new Map<number, typeof venues.$inferSelect>();

        for (const v of existingVenues) {
          venueCache.set(v.id, v);
        }
      }

      const resolvedVenueCache = venueCache;

      const venueInFlight =
        options?.venueInFlight ??
        new Map<number, Promise<typeof venues.$inferSelect | null>>();

      const matchConcurrency = options?.matchConcurrency ?? 6;
      const matchRowsToUpsert: Array<typeof matches.$inferInsert> = [];
      let nextMatchIndex = 0;

      const matchWorker = async () => {
        while (nextMatchIndex < rawMatches.length) {
          const index = nextMatchIndex++;
          const m = rawMatches[index];

          const homeId = this.getTeamId(m.homeTeam, teamDbIdMap);
          const guestId = this.getTeamId(m.guestTeam, teamDbIdMap);

          if (!homeId || !guestId) {
            continue;
          }

          const existingMatch = existingMatchMap.get(m.matchId);

          if (
            existingMatch &&
            existingMatch.result !== null &&
            existingMatch.result.trim() !== ''
          ) {
            continue;
          }

          let venueId: number | null = null;
          const knownVenueId = existingMatch?.venueId;

          if (knownVenueId !== undefined && knownVenueId !== null) {
            venueId = knownVenueId;
          } else if (!options?.quickSync) {
            try {
              const info = await this.dbbClient.fetchMatchInfo(m.matchId);
              const spielfeld = info.data?.matchInfo?.spielfeld;

              if (spielfeld && spielfeld.id) {
                venueId = spielfeld.id;
                const cachedVenue = resolvedVenueCache.get(spielfeld.id);

                if (!cachedVenue || cachedVenue.latitude === null) {
                  let inFlightPromise = venueInFlight.get(spielfeld.id);

                  if (!inFlightPromise) {
                    inFlightPromise = this.geocodeAndUpsertVenue(
                      db,
                      spielfeld,
                      resolvedVenueCache
                    )
                      .then((res) => {
                        if (res.synced) {
                          syncedVenuesCount++;
                        }

                        if (res.geocoded) {
                          geocodedVenuesCount++;
                        }

                        return res.venue;
                      })
                      .finally(() => {
                        venueInFlight.delete(spielfeld.id);
                      });

                    venueInFlight.set(spielfeld.id, inFlightPromise);
                  }

                  await inFlightPromise;
                }
              }

              await this.clearMatchFailure(m.matchId);
            } catch (err) {
              this.logger.warn(`Could not fetch matchInfo for match ${m.matchId}:`, err);
              matchErrorsCount++;
              const errorMsg = err instanceof Error ? err.message : String(err);

              await this.recordFailure({
                entityType: 'match',
                dbbLeagueId: ligaId,
                leagueName,
                dbbMatchId: m.matchId,
                verbandId: options?.verbandId,
                errorMessage: errorMsg,
              });
            }
          }

          matchRowsToUpsert.push({
            id: m.matchId,
            leagueId: dbLeague.id,
            matchDay: m.matchDay,
            matchNo: m.matchNo || null,
            kickoffDate: m.kickoffDate ?? null,
            kickoffTime: m.kickoffTime || '00:00',
            homeTeamId: homeId,
            guestTeamId: guestId,
            venueId,
            result: m.result || null,
            confirmed: Boolean(m.ergebnisbestaetigt),
            rawData: m,
            updatedAt: new Date(),
          });
        }
      };

      const matchWorkerCount = Math.min(matchConcurrency, rawMatches.length);
      const matchWorkers = Array.from({ length: matchWorkerCount }, () => matchWorker());

      await Promise.all(matchWorkers);

      // 5. Batch Upsert Matches
      if (matchRowsToUpsert.length > 0) {
        await db
          .insert(matches)
          .values(matchRowsToUpsert)
          .onConflictDoUpdate({
            target: matches.id,
            set: {
              kickoffDate: sql`excluded.kickoff_date`,
              kickoffTime: sql`excluded.kickoff_time`,
              venueId: sql`coalesce(excluded.venue_id, ${matches.venueId})`,
              result: sql`excluded.result`,
              confirmed: sql`excluded.confirmed`,
              rawData: sql`excluded.raw_data`,
              updatedAt: sql`excluded.updated_at`,
            },
          });

        syncedMatchesCount = matchRowsToUpsert.length;
      }

      await this.clearLeagueFailure(ligaId);

      if (matchErrorsCount === 0) {
        await this.clearFailures(ligaId);
      }

      const durationMs = Date.now() - startTime;
      const completionDate = new Date();

      this.lastSyncedAt = completionDate;
      await this.persistLastSyncedAt(completionDate);

      this.logger.log(
        `Finished sync for league ${ligaId} ("${ligaData.liganame}"): ` +
          `${syncedMatchesCount}/${rawMatches.length} matches, ` +
          `${syncedVenuesCount} new venues (${geocodedVenuesCount} geocoded) in ${durationMs}ms.`
      );

      return {
        leagueId: ligaData.ligaId,
        leagueName: ligaData.liganame,
        totalMatches: rawMatches.length,
        syncedMatches: syncedMatchesCount,
        syncedVenues: syncedVenuesCount,
        geocodedVenues: geocodedVenuesCount,
        durationMs,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during sync for league ${ligaId}: ${errorMsg}`);

      await this.recordFailure({
        entityType: 'league',
        dbbLeagueId: ligaId,
        leagueName,
        verbandId: options?.verbandId,
        errorMessage: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Synchronizes all leagues for a specific Verband with concurrency limiting and throttling.
   */
  async syncVerbandLeagues(
    verbandId = 1,
    options?: SyncVerbandOptions
  ): Promise<VerbandSyncResult> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to persist scraped data.'
      );
    }

    const startTime = Date.now();
    const concurrency = options?.concurrency ?? 5;
    const throttleMs = options?.throttleMs ?? 50;

    this.logger.log(
      `Starting full discovery and sync for Verband ${verbandId} ` +
        `(concurrency: ${concurrency}, quickSync: ${Boolean(options?.quickSync)})...`
    );

    const allLeagues = await this.dbbClient.fetchAllWamLeagues(verbandId);

    this.logger.log(`Discovered ${allLeagues.length} leagues for Verband ${verbandId}.`);

    // Preload shared venue cache across all leagues to avoid duplicate queries and geocoding
    const existingVenues = await this.db.select().from(venues);
    const venueCache = new Map<number, typeof venues.$inferSelect>();

    for (const v of existingVenues) {
      venueCache.set(v.id, v);
    }

    const venueInFlight = new Map<
      number,
      Promise<typeof venues.$inferSelect | null>
    >();

    let totalMatches = 0;
    let syncedMatches = 0;
    let syncedVenues = 0;
    let geocodedVenues = 0;
    let successfulLeagues = 0;
    let failedLeagues = 0;
    const leagueResults: SyncResult[] = [];

    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < allLeagues.length) {
        const index = nextIndex++;
        const league = allLeagues[index];

        try {
          const result = await this.syncLeague(league.ligaId, {
            quickSync: options?.quickSync,
            venueCache,
            venueInFlight,
            verbandId,
            leagueName: league.liganame,
          });

          totalMatches += result.totalMatches;
          syncedMatches += result.syncedMatches;
          syncedVenues += result.syncedVenues;
          geocodedVenues += result.geocodedVenues;
          successfulLeagues++;
          leagueResults.push(result);

          this.logger.log(
            `[${successfulLeagues + failedLeagues}/${allLeagues.length}] ` +
              `Synced league ${league.ligaId} ("${league.liganame}"): ` +
              `${result.syncedMatches}/${result.totalMatches} matches, ` +
              `${result.syncedVenues} new venues (${result.geocodedVenues} geocoded).`
          );
        } catch (error) {
          failedLeagues++;
          this.logger.error(
            `Failed to sync league ${league.ligaId} ("${league.liganame}"):`,
            error
          );
        }

        if (throttleMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, throttleMs));
        }
      }
    };

    const workerCount = Math.min(concurrency, allLeagues.length);
    const workers = Array.from({ length: workerCount }, () => worker());

    await Promise.all(workers);

    const durationMs = Date.now() - startTime;
    const completionDate = new Date();

    this.lastSyncedAt = completionDate;
    await this.persistLastSyncedAt(completionDate);

    this.logger.log(
      `Verband ${verbandId} sync completed in ${durationMs}ms: ` +
        `${successfulLeagues}/${allLeagues.length} leagues succeeded (${failedLeagues} failed), ` +
        `${syncedMatches} matches synced (${totalMatches} total scheduled), ` +
        `${syncedVenues} venues synced (${geocodedVenues} geocoded).`
    );

    return {
      verbandId,
      totalLeagues: allLeagues.length,
      successfulLeagues,
      failedLeagues,
      totalMatches,
      syncedMatches,
      syncedVenues,
      geocodedVenues,
      durationMs,
      leagueResults,
    };
  }

  /**
   * Synchronizes all leagues in Baden-Württemberg (Verband ID 1) into the database.
   */
  async syncAllBawueLeagues(options?: SyncVerbandOptions): Promise<VerbandSyncResult> {
    return this.syncVerbandLeagues(1, options);
  }

  /**
   * Retrieves all recorded sync failures ordered by failedAt descending.
   */
  async getFailures(options?: {
    verbandId?: number;
  }): Promise<Array<typeof syncFailures.$inferSelect>> {
    if (!this.db) {
      return [];
    }

    try {
      if (options?.verbandId !== undefined) {
        return await this.db
          .select()
          .from(syncFailures)
          .where(eq(syncFailures.verbandId, options.verbandId))
          .orderBy(desc(syncFailures.failedAt));
      }

      return await this.db
        .select()
        .from(syncFailures)
        .orderBy(desc(syncFailures.failedAt));
    } catch (err) {
      this.logger.warn('Failed to query sync failures:', err);

      return [];
    }
  }

  /**
   * Retries synchronization for all failed leagues.
   * Loads distinct dbbLeagueIds from sync_failures, re-runs syncLeague for each,
   * updates retryCount on failure or deletes the failure row on success.
   */
  async retryFailed(options?: {
    verbandId?: number;
  }): Promise<RetryFailedResult> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to retry failed syncs.'
      );
    }

    const currentFailures = await this.getFailures(options);

    const distinctLeagueIds = Array.from(
      new Set(currentFailures.map((f) => f.dbbLeagueId))
    );

    const leagueMetaMap = new Map<
      number,
      { leagueName?: string | null; verbandId?: number | null }
    >();

    for (const f of currentFailures) {
      if (!leagueMetaMap.has(f.dbbLeagueId)) {
        leagueMetaMap.set(f.dbbLeagueId, {
          leagueName: f.leagueName,
          verbandId: f.verbandId,
        });
      }
    }

    let resolvedCount = 0;
    let stillFailingCount = 0;

    for (const leagueId of distinctLeagueIds) {
      const meta = leagueMetaMap.get(leagueId);

      try {
        await this.syncLeague(leagueId, {
          verbandId: meta?.verbandId ?? undefined,
          leagueName: meta?.leagueName ?? undefined,
        });

        resolvedCount++;
      } catch {
        stillFailingCount++;
      }
    }

    const remainingFailures = await this.getFailures(options);

    return {
      retriedCount: distinctLeagueIds.length,
      resolvedCount,
      stillFailingCount,
      failures: remainingFailures,
      retriedLeagues: distinctLeagueIds.length,
      resolved: resolvedCount,
      stillFailing: stillFailingCount,
    };
  }

  /**
   * Backfills coordinates for all venues in the database that currently have null latitude or longitude.
   */
  async geocodeMissingVenues(): Promise<{
    totalMissing: number;
    geocoded: number;
    failed: number;
  }> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to geocode venues.'
      );
    }

    const missingVenues = await this.db
      .select()
      .from(venues)
      .where(or(isNull(venues.latitude), isNull(venues.longitude)));

    this.logger.log(`Found ${missingVenues.length} venues with missing coordinates.`);

    let geocoded = 0;
    let failed = 0;

    for (const venue of missingVenues) {
      const coords = await this.geocoder.geocodeAddress(
        venue.street ?? '',
        venue.postalCode ?? '',
        venue.city ?? ''
      );

      if (coords) {
        await this.db
          .update(venues)
          .set({
            latitude: coords.latitude,
            longitude: coords.longitude,
            location: { lng: coords.longitude, lat: coords.latitude },
            geocodedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(venues.id, venue.id));

        geocoded++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Finished geocoding missing venues: ${geocoded} geocoded, ${failed} failed (out of ${missingVenues.length}).`
    );

    return {
      totalMissing: missingVenues.length,
      geocoded,
      failed,
    };
  }

  private async geocodeAndUpsertVenue(
    db: DrizzleDb,
    spielfeld: DbbVenue,
    venueCache: Map<number, typeof venues.$inferSelect>
  ): Promise<{
    venue: typeof venues.$inferSelect | null;
    synced: boolean;
    geocoded: boolean;
  }> {
    let lat: number | null = null;
    let lng: number | null = null;
    let geocoded = false;

    if (spielfeld.strasse || spielfeld.ort) {
      const geo = await this.geocoder.geocodeAddress(
        spielfeld.strasse,
        spielfeld.plz,
        spielfeld.ort
      );

      if (geo) {
        lat = geo.latitude;
        lng = geo.longitude;
        geocoded = true;
      }
    }

    const location = lat !== null && lng !== null ? { lng, lat } : null;

    const venueValues = {
      id: spielfeld.id,
      name: spielfeld.bezeichnung || 'Unbekannte Sporthalle',
      street: spielfeld.strasse || null,
      postalCode: spielfeld.plz || null,
      city: spielfeld.ort || null,
      latitude: lat,
      longitude: lng,
      location,
      geocodedAt: lat !== null ? new Date() : null,
      rawData: spielfeld,
      updatedAt: new Date(),
    };

    const venueUpdateValues: Partial<typeof venues.$inferInsert> = {
      name: spielfeld.bezeichnung || 'Unbekannte Sporthalle',
      street: spielfeld.strasse || null,
      postalCode: spielfeld.plz || null,
      city: spielfeld.ort || null,
      rawData: spielfeld,
      updatedAt: new Date(),
    };

    if (lat !== null && lng !== null) {
      venueUpdateValues.latitude = lat;
      venueUpdateValues.longitude = lng;
      venueUpdateValues.location = location;
      venueUpdateValues.geocodedAt = new Date();
    }

    const [insertedVenue] = await db
      .insert(venues)
      .values(venueValues)
      .onConflictDoUpdate({
        target: venues.id,
        set: venueUpdateValues,
      })
      .returning();

    venueCache.set(spielfeld.id, insertedVenue);

    return {
      venue: insertedVenue,
      synced: true,
      geocoded,
    };
  }

  private collectTeam(
    t: DbbTeam | null | undefined,
    map: Map<number, { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }>
  ) {
    if (!t) {
      return;
    }

    const id = t.seasonTeamId || t.teamCompetitionId || t.teamPermanentId;

    if (id && !map.has(id)) {
      map.set(id, {
        dbbId: id,
        name: t.teamname,
        shortName: t.teamnameSmall,
        clubId: t.clubId,
        raw: t,
      });
    }
  }

  private getTeamId(
    t: DbbTeam | null | undefined,
    idMap: Map<number, number>
  ): number | null {
    if (!t) {
      return null;
    }

    const id = t.seasonTeamId || t.teamCompetitionId || t.teamPermanentId;

    return id ? idMap.get(id) || null : null;
  }

  /**
   * Returns the ISO timestamp of the last successful sync.
   * Checks in-memory cache first, then the system_settings table,
   * and finally falls back to the latest updatedAt among matches and leagues.
   */
  async getLastSyncedAt(): Promise<string | null> {
    if (this.lastSyncedAt) {
      return this.lastSyncedAt.toISOString();
    }

    if (!this.db) {
      return null;
    }

    try {
      const [setting] = await this.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'last_synced_at'))
        .limit(1);

      if (setting?.value) {
        return setting.value;
      }
    } catch {
      this.logger.debug('system_settings table not accessible, falling back to matches/leagues');
    }

    try {
      const [latestMatch] = await this.db
        .select({ updatedAt: matches.updatedAt })
        .from(matches)
        .orderBy(desc(matches.updatedAt))
        .limit(1);

      if (latestMatch?.updatedAt) {
        return latestMatch.updatedAt.toISOString();
      }

      const [latestLeague] = await this.db
        .select({ updatedAt: leagues.updatedAt })
        .from(leagues)
        .orderBy(desc(leagues.updatedAt))
        .limit(1);

      if (latestLeague?.updatedAt) {
        return latestLeague.updatedAt.toISOString();
      }
    } catch (err) {
      this.logger.warn('Failed to query fallback sync timestamp from database:', err);
    }

    return null;
  }

  setLastSyncedAt(date: Date | null): void {
    this.lastSyncedAt = date;
  }

  private async persistLastSyncedAt(date: Date): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db
        .insert(systemSettings)
        .values({
          key: 'last_synced_at',
          value: date.toISOString(),
          updatedAt: date,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: date.toISOString(),
            updatedAt: date,
          },
        });
    } catch (err) {
      this.logger.warn('Could not persist lastSyncedAt to system_settings table:', err);
    }
  }

  private async recordFailure(data: {
    entityType: 'league' | 'match';
    dbbLeagueId: number;
    leagueName?: string | null;
    dbbMatchId?: number | null;
    verbandId?: number | null;
    errorMessage: string;
  }): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      if (data.entityType === 'match' && data.dbbMatchId) {
        const existing = await this.db
          .select()
          .from(syncFailures)
          .where(
            and(
              eq(syncFailures.entityType, 'match'),
              eq(syncFailures.dbbMatchId, data.dbbMatchId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          await this.db
            .update(syncFailures)
            .set({
              errorMessage: data.errorMessage,
              retryCount: sql`${syncFailures.retryCount} + 1`,
              updatedAt: new Date(),
              leagueName: data.leagueName ?? existing[0].leagueName,
              verbandId: data.verbandId ?? existing[0].verbandId,
            })
            .where(eq(syncFailures.id, existing[0].id));
        } else {
          await this.db.insert(syncFailures).values({
            entityType: 'match',
            dbbLeagueId: data.dbbLeagueId,
            leagueName: data.leagueName ?? null,
            dbbMatchId: data.dbbMatchId,
            verbandId: data.verbandId ?? null,
            errorMessage: data.errorMessage,
            retryCount: 0,
            failedAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return;
      }

      const existing = await this.db
        .select()
        .from(syncFailures)
        .where(
          and(
            eq(syncFailures.entityType, 'league'),
            eq(syncFailures.dbbLeagueId, data.dbbLeagueId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(syncFailures)
          .set({
            errorMessage: data.errorMessage,
            retryCount: sql`${syncFailures.retryCount} + 1`,
            updatedAt: new Date(),
            leagueName: data.leagueName ?? existing[0].leagueName,
            verbandId: data.verbandId ?? existing[0].verbandId,
          })
          .where(eq(syncFailures.id, existing[0].id));
      } else {
        await this.db.insert(syncFailures).values({
          entityType: 'league',
          dbbLeagueId: data.dbbLeagueId,
          leagueName: data.leagueName ?? null,
          dbbMatchId: null,
          verbandId: data.verbandId ?? null,
          errorMessage: data.errorMessage,
          retryCount: 0,
          failedAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to record sync failure for ${data.entityType} ${data.dbbLeagueId}:`,
        err
      );
    }
  }

  private async clearFailures(dbbLeagueId: number): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db
        .delete(syncFailures)
        .where(eq(syncFailures.dbbLeagueId, dbbLeagueId));
    } catch (err) {
      this.logger.warn(`Failed to clear sync failures for league ${dbbLeagueId}:`, err);
    }
  }

  private async clearLeagueFailure(dbbLeagueId: number): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db
        .delete(syncFailures)
        .where(
          and(
            eq(syncFailures.dbbLeagueId, dbbLeagueId),
            eq(syncFailures.entityType, 'league')
          )
        );
    } catch (err) {
      this.logger.warn(`Failed to clear league failure for league ${dbbLeagueId}:`, err);
    }
  }

  private async clearMatchFailure(dbbMatchId: number): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      await this.db
        .delete(syncFailures)
        .where(
          and(
            eq(syncFailures.dbbMatchId, dbbMatchId),
            eq(syncFailures.entityType, 'match')
          )
        );
    } catch (err) {
      this.logger.warn(`Failed to clear match failure for match ${dbbMatchId}:`, err);
    }
  }
}
