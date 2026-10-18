import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { SyncResult, VerbandSyncResult } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { leagues, matches, systemSettings, teams, venues } from '../database/schema';
import { DbbClientService, DbbTeam } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';

export interface SyncLeagueOptions {
  quickSync?: boolean;
  venueCache?: Map<number, typeof venues.$inferSelect>;
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

    const startTime = Date.now();
    this.logger.log(`Starting sync for league ${ligaId}...`);

    const spielplan = await this.dbbClient.fetchSpielplan(ligaId);
    const { ligaData, matches: rawMatches } = spielplan.data;

    if (!ligaData) {
      throw new Error(`Invalid response from DBB: No league data found for ID ${ligaId}`);
    }

    // 1. Upsert League
    const [dbLeague] = await this.db
      .insert(leagues)
      .values({
        dbbId: ligaData.ligaId,
        name: ligaData.liganame,
        seasonId: ligaData.seasonId,
        seasonName: ligaData.seasonName,
        verbandName: ligaData.verbandName || 'Baden-Württemberg',
        rawData: ligaData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leagues.dbbId,
        set: {
          name: ligaData.liganame,
          seasonName: ligaData.seasonName,
          rawData: ligaData,
          updatedAt: new Date(),
        },
      })
      .returning();

    // 2. Collect & Upsert Teams
    const teamMap = new Map<number, { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }>();

    for (const m of rawMatches) {
      this.collectTeam(m.homeTeam, teamMap);
      this.collectTeam(m.guestTeam, teamMap);
    }

    const teamDbIdMap = new Map<number, number>(); // dbbId -> internal team.id

    for (const t of teamMap.values()) {
      const [upserted] = await this.db
        .insert(teams)
        .values({
          dbbId: t.dbbId,
          name: t.name,
          shortName: t.shortName,
          clubId: t.clubId,
          rawData: t.raw,
        })
        .onConflictDoUpdate({
          target: teams.dbbId,
          set: {
            name: t.name,
            shortName: t.shortName,
            clubId: t.clubId,
            rawData: t.raw,
          },
        })
        .returning();

      teamDbIdMap.set(t.dbbId, upserted.id);
    }

    // 3. Preload Existing Matches for this League to detect already known venues
    const existingLeagueMatches = await this.db
      .select({ id: matches.id, venueId: matches.venueId })
      .from(matches)
      .where(eq(matches.leagueId, dbLeague.id));

    const existingMatchVenueMap = new Map<number, number | null>();

    for (const em of existingLeagueMatches) {
      existingMatchVenueMap.set(em.id, em.venueId);
    }

    // 4. Sync Matches and Venues (Gyms)
    let geocodedVenuesCount = 0;
    let syncedVenuesCount = 0;
    let syncedMatchesCount = 0;

    let venueCache = options?.venueCache;

    if (!venueCache) {
      const existingVenues = await this.db.select().from(venues);
      venueCache = new Map<number, typeof venues.$inferSelect>();

      for (const v of existingVenues) {
        venueCache.set(v.id, v);
      }
    }

    for (const m of rawMatches) {
      let venueId: number | null = null;
      const knownVenueId = existingMatchVenueMap.get(m.matchId);

      if (knownVenueId !== undefined && knownVenueId !== null) {
        venueId = knownVenueId;
      } else if (!options?.quickSync) {
        // Fetch venue details from matchInfo if venue is not yet known
        try {
          const info = await this.dbbClient.fetchMatchInfo(m.matchId);
          const spielfeld = info.data?.matchInfo?.spielfeld;

          if (spielfeld && spielfeld.id) {
            venueId = spielfeld.id;
            const cachedVenue = venueCache.get(spielfeld.id);

            if (!cachedVenue || cachedVenue.latitude === null) {
              // Geocode new or unlocated venue
              let lat: number | null = null;
              let lng: number | null = null;

              if (spielfeld.strasse || spielfeld.ort) {
                const geo = await this.geocoder.geocodeAddress(
                  spielfeld.strasse,
                  spielfeld.plz,
                  spielfeld.ort
                );

                if (geo) {
                  lat = geo.latitude;
                  lng = geo.longitude;
                  geocodedVenuesCount++;
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

              const [insertedVenue] = await this.db
                .insert(venues)
                .values(venueValues)
                .onConflictDoUpdate({
                  target: venues.id,
                  set: venueUpdateValues,
                })
                .returning();

              venueCache.set(spielfeld.id, insertedVenue);
              syncedVenuesCount++;
            }
          }
        } catch (err) {
          this.logger.warn(`Could not fetch matchInfo for match ${m.matchId}:`, err);
        }
      }

      const homeId = this.getTeamId(m.homeTeam, teamDbIdMap);
      const guestId = this.getTeamId(m.guestTeam, teamDbIdMap);

      if (homeId && guestId) {
        const matchUpdateValues: Partial<typeof matches.$inferInsert> = {
          kickoffDate: m.kickoffDate,
          kickoffTime: m.kickoffTime || '00:00',
          result: m.result || null,
          confirmed: Boolean(m.ergebnisbestaetigt),
          rawData: m,
          updatedAt: new Date(),
        };

        if (venueId !== null) {
          matchUpdateValues.venueId = venueId;
        }

        await this.db
          .insert(matches)
          .values({
            id: m.matchId,
            leagueId: dbLeague.id,
            matchDay: m.matchDay,
            matchNo: m.matchNo || null,
            kickoffDate: m.kickoffDate,
            kickoffTime: m.kickoffTime || '00:00',
            homeTeamId: homeId,
            guestTeamId: guestId,
            venueId: venueId,
            result: m.result || null,
            confirmed: Boolean(m.ergebnisbestaetigt),
            rawData: m,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: matches.id,
            set: matchUpdateValues,
          });

        syncedMatchesCount++;
      }
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
    const concurrency = options?.concurrency ?? 3;
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

  private collectTeam(
    t: DbbTeam,
    map: Map<number, { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }>
  ) {
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

  private getTeamId(t: DbbTeam, idMap: Map<number, number>): number | null {
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
}
