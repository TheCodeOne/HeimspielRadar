import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import {
  DeltaSyncResult,
  GERMAN_BASKETBALL_VERBAENDE,
  RetryFailedResult,
  SyncResult,
  SyncVerbandDeltaResult,
  VerbandInfo,
  VerbandSyncResult,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  LeagueRawData,
  leagues,
  matches,
  syncFailures,
  syncRuns,
  systemSettings,
  teams,
  venues,
} from '../database/schema';
import {
  DbbClientService,
  DbbTabelleEntry,
  DbbTeam,
  DbbVenue,
} from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { TelegramNotifierService } from './telegram-notifier.service';

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

export interface SyncLeagueDeltaOptions {
  rangeDays?: number;
  venueCache?: Map<number, typeof venues.$inferSelect>;
  venueInFlight?: Map<number, Promise<typeof venues.$inferSelect | null>>;
  verbandId?: number;
  leagueName?: string;
}

export interface SyncVerbandDeltaOptions {
  rangeDays?: number;
  concurrency?: number;
  throttleMs?: number;
}

export function getActiveVerbaende(): readonly VerbandInfo[] {
  const customIds = process.env['ACTIVE_VERBAND_IDS'];

  if (customIds) {
    const ids = new Set(
      customIds
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n))
    );

    const filtered = GERMAN_BASKETBALL_VERBAENDE.filter((v) => ids.has(v.id));

    if (filtered.length > 0) {
      return filtered;
    }
  }

  return GERMAN_BASKETBALL_VERBAENDE;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private lastSyncedAt: Date | null = null;
  private isSyncRunning = false;
  private activeSyncRunId: number | null = null;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly dbbClient: DbbClientService,
    private readonly geocoder: GeocoderService,
    @Optional() private readonly telegramNotifier?: TelegramNotifierService
  ) {}

  /**
   * Derives a non-empty name for a league, falling back to its metadata or ID when DBB returns null.
   */
  private resolveLeagueName(
    ligaData: {
      ligaId: number;
      liganame?: string | null;
      skName?: string | null;
      akName?: string | null;
      geschlecht?: string | null;
      bezirkName?: string | null;
      kreisname?: string | null;
    },
    fallbackName?: string | null
  ): string {
    const rawName = ligaData.liganame?.trim();

    if (rawName) {
      return rawName;
    }

    const passedFallback = fallbackName?.trim();

    if (passedFallback) {
      return passedFallback;
    }

    const segments = [
      ligaData.akName?.trim(),
      ligaData.skName?.trim(),
      ligaData.geschlecht?.trim(),
      ligaData.bezirkName?.trim() || ligaData.kreisname?.trim(),
    ].filter((s): s is string => Boolean(s));

    if (segments.length > 0) {
      return segments.join(' ');
    }

    return `Liga ${ligaData.ligaId}`;
  }

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

      leagueName = this.resolveLeagueName(ligaData, options?.leagueName);

      // 1. Upsert League
      const [dbLeague] = await db
        .insert(leagues)
        .values({
          dbbId: ligaData.ligaId,
          name: leagueName,
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
            name: leagueName,
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
        leagueId: dbLeague.id,
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
              leagueId: sql`coalesce(excluded.league_id, ${teams.leagueId})`,
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
        `Finished sync for league ${ligaId} ("${leagueName}"): ` +
          `${syncedMatchesCount}/${rawMatches.length} matches, ` +
          `${syncedVenuesCount} new venues (${geocodedVenuesCount} geocoded) in ${durationMs}ms.`
      );

      return {
        leagueId: ligaData.ligaId,
        leagueName,
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
   * Persists certified official standings table into league rawData.
   */
  async upsertLeagueStandings(
    dbbLeagueId: number,
    standings: DbbTabelleEntry[]
  ): Promise<void> {
    if (!this.db) {
      return;
    }

    const [existingLeague] = await this.db
      .select({ id: leagues.id, rawData: leagues.rawData })
      .from(leagues)
      .where(eq(leagues.dbbId, dbbLeagueId))
      .limit(1);

    if (existingLeague) {
      const currentRaw: LeagueRawData = existingLeague.rawData ?? {};

      await this.db
        .update(leagues)
        .set({
          rawData: {
            ...currentRaw,
            tabelle: standings,
          },
          updatedAt: new Date(),
        })
        .where(eq(leagues.id, existingLeague.id));
    }
  }

  /**
   * Computes the statistical mode (most frequent) venue among verified home fixtures
   * and updates teams.primaryVenueId.
   */
  async recalculateTeamPrimaryVenue(
    teamDbbId: number,
    fallbackVenueId?: number
  ): Promise<number | null> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env.'
      );
    }

    const [team] = await this.db
      .select({ id: teams.id, primaryVenueId: teams.primaryVenueId })
      .from(teams)
      .where(eq(teams.dbbId, teamDbbId))
      .limit(1);

    if (!team) {
      this.logger.warn(
        `Cannot recalculate primary venue: team with dbbId ${teamDbbId} not found`
      );

      return null;
    }

    const venueCounts = await this.db
      .select({
        venueId: matches.venueId,
        count: sql<number>`count(*)::int`,
      })
      .from(matches)
      .where(
        and(
          eq(matches.homeTeamId, team.id),
          eq(matches.isVenueVerified, true),
          isNotNull(matches.venueId)
        )
      )
      .groupBy(matches.venueId)
      .orderBy(desc(sql`count(*)`));

    const modeVenueId =
      venueCounts.length > 0 && venueCounts[0].venueId
        ? venueCounts[0].venueId
        : fallbackVenueId ?? team.primaryVenueId ?? null;

    if (modeVenueId !== null && team.primaryVenueId !== modeVenueId) {
      await this.db
        .update(teams)
        .set({ primaryVenueId: modeVenueId })
        .where(eq(teams.id, team.id));

      this.logger.debug(
        `Updated primaryVenueId for team dbbId ${teamDbbId} (id ${team.id}) to ${modeVenueId}`
      );
    }

    return modeVenueId;
  }

  /**
   * Synchronizes windowed league fixtures and standings using Two-Tier Venue Verification
   * and Majority Voting.
   */
  async syncLeagueDelta(
    liganr: number,
    options?: SyncLeagueDeltaOptions
  ): Promise<DeltaSyncResult> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to persist scraped data.'
      );
    }

    const db = this.db;
    const startTime = Date.now();
    const rangeDays = options?.rangeDays ?? 14;
    let leagueName = options?.leagueName ?? null;
    let matchErrorsCount = 0;

    this.logger.log(`Starting delta-sync for league ${liganr} (rangeDays: ${rangeDays})...`);

    try {
      const actualRes = await this.dbbClient.fetchCompetitionActual(liganr, rangeDays);

      if (!actualRes.data || !actualRes.data.ligaData) {
        this.logger.debug(
          `No active competition data returned for league ${liganr}, skipping delta sync.`
        );

        return {
          success: true,
          leagueId: liganr,
          leagueName: leagueName ?? `Liga ${liganr}`,
          totalMatches: 0,
          syncedMatches: 0,
          verifiedMatches: 0,
          provisionalMatches: 0,
          syncedVenues: 0,
          geocodedVenues: 0,
          durationMs: Date.now() - startTime,
        };
      }

      const { ligaData, matches: windowMatches = [], tabelle } = actualRes.data;

      leagueName = this.resolveLeagueName(ligaData, options?.leagueName);

      // 1. Upsert League with Standings
      const [dbLeague] = await db
        .insert(leagues)
        .values({
          dbbId: ligaData.ligaId,
          name: leagueName,
          seasonId: ligaData.seasonId,
          seasonName: ligaData.seasonName,
          verbandName: ligaData.verbandName || 'Baden-Württemberg',
          skName: ligaData.skName || null,
          akName: ligaData.akName || null,
          geschlecht: ligaData.geschlecht || null,
          rawData: { ...ligaData, tabelle: tabelle ?? null },
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: leagues.dbbId,
          set: {
            name: leagueName,
            seasonName: ligaData.seasonName,
            skName: ligaData.skName || null,
            akName: ligaData.akName || null,
            geschlecht: ligaData.geschlecht || null,
            rawData: { ...ligaData, tabelle: tabelle ?? null },
            updatedAt: new Date(),
          },
        })
        .returning();

      // 2. Ingest certified standings table if present
      if (tabelle?.entries) {
        await this.upsertLeagueStandings(ligaData.ligaId, tabelle.entries);
      }

      // 3. Collect & Batch Upsert Teams
      const teamMap = new Map<
        number,
        { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }
      >();

      for (const m of windowMatches) {
        this.collectTeam(m.homeTeam, teamMap);
        this.collectTeam(m.guestTeam, teamMap);
      }

      if (tabelle?.entries) {
        for (const entry of tabelle.entries) {
          this.collectTeam(entry.team, teamMap);
        }
      }

      const teamDbIdMap = new Map<number, number>();
      const teamPrimaryVenueMap = new Map<number, number | null>();

      const teamValues = Array.from(teamMap.values()).map((t) => ({
        dbbId: t.dbbId,
        name: t.name,
        shortName: t.shortName,
        clubId: t.clubId,
        leagueId: dbLeague.id,
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
              leagueId: sql`coalesce(excluded.league_id, ${teams.leagueId})`,
              rawData: sql`excluded.raw_data`,
            },
          })
          .returning();

        for (let i = 0; i < teamValues.length; i++) {
          const upserted = upsertedTeams[i] ?? upsertedTeams[0];

          if (upserted) {
            const dbbId = upserted.dbbId ?? teamValues[i].dbbId;
            teamDbIdMap.set(dbbId, upserted.id);

            if (upserted.primaryVenueId !== undefined) {
              teamPrimaryVenueMap.set(dbbId, upserted.primaryVenueId ?? null);
            }
          }
        }

        const teamDbbIds = Array.from(teamMap.keys());

        const loadedTeams = await db
          .select({
            id: teams.id,
            dbbId: teams.dbbId,
            primaryVenueId: teams.primaryVenueId,
          })
          .from(teams)
          .where(inArray(teams.dbbId, teamDbbIds));

        for (const t of loadedTeams) {
          teamDbIdMap.set(t.dbbId, t.id);

          if (t.primaryVenueId !== null && t.primaryVenueId !== undefined) {
            teamPrimaryVenueMap.set(t.dbbId, t.primaryVenueId);
          }
        }
      }

      // 4. Preload Existing Matches for this Window
      const matchDbbIds = windowMatches.map((m) => m.matchId).filter(Boolean);

      const existingMatches =
        matchDbbIds.length > 0
          ? await db
              .select({
                id: matches.id,
                kickoffDate: matches.kickoffDate,
                kickoffTime: matches.kickoffTime,
                venueId: matches.venueId,
                isVenueVerified: matches.isVenueVerified,
                result: matches.result,
              })
              .from(matches)
              .where(inArray(matches.id, matchDbbIds))
          : [];

      const existingMatchMap = new Map<
        number,
        {
          id: number;
          kickoffDate: string | null;
          kickoffTime: string | null;
          venueId: number | null;
          isVenueVerified: boolean;
          result: string | null;
        }
      >();

      for (const em of existingMatches) {
        existingMatchMap.set(em.id, em);
      }

      // 5. Shared Venue Cache & In-Flight Tracking
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

      // 6. Tier 1 Window Cutoff in Europe/Berlin Timezone
      const limitDate = new Date(Date.now() + rangeDays * 24 * 60 * 60 * 1000);

      const limitDateBerlin = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(limitDate);

      // Sort matches chronologically so imminent matches are processed before distant matches
      const sortedMatches = [...windowMatches].sort((a, b) => {
        if (!a.kickoffDate && !b.kickoffDate) {
          return 0;
        }

        if (!a.kickoffDate) {
          return 1;
        }

        if (!b.kickoffDate) {
          return -1;
        }

        const dateDiff = a.kickoffDate.localeCompare(b.kickoffDate);

        if (dateDiff !== 0) {
          return dateDiff;
        }

        return (a.kickoffTime || '00:00').localeCompare(b.kickoffTime || '00:00');
      });

      let geocodedVenuesCount = 0;
      let syncedVenuesCount = 0;
      let verifiedMatchesCount = 0;
      let provisionalMatchesCount = 0;
      const verifiedHomeTeamDbbIds = new Set<number>();
      const matchRowsToUpsert: Array<typeof matches.$inferInsert> = [];

      for (const m of sortedMatches) {
        const homeId = this.getTeamId(m.homeTeam, teamDbIdMap);
        const guestId = this.getTeamId(m.guestTeam, teamDbIdMap);
        const homeDbbId = this.resolveDbbTeamId(m.homeTeam);

        if (!homeId || !guestId) {
          continue;
        }

        const existing = existingMatchMap.get(m.matchId);
        const kickoffDateNormalized = m.kickoffDate ?? null;
        const kickoffTimeNormalized = m.kickoffTime || '00:00';

        const kickoffChanged =
          Boolean(existing) &&
          (existing?.kickoffDate !== kickoffDateNormalized ||
            existing?.kickoffTime !== kickoffTimeNormalized);

        const isImminent =
          Boolean(m.kickoffDate) && m.kickoffDate! <= limitDateBerlin;

        let venueId: number | null = null;
        let isVerified = false;

        if (isImminent) {
          // Tier 1: Imminent 14-day Window (or past unverified/rescheduled)
          const needsVerification = !existing?.isVenueVerified || kickoffChanged;

          if (!needsVerification) {
            venueId = existing?.venueId ?? null;
            isVerified = true;
          } else {
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

                isVerified = true;

                if (homeDbbId) {
                  verifiedHomeTeamDbbIds.add(homeDbbId);

                  const modeVenue = await this.recalculateTeamPrimaryVenue(
                    homeDbbId,
                    venueId
                  );

                  if (modeVenue) {
                    teamPrimaryVenueMap.set(homeDbbId, modeVenue);
                  }
                }
              }

              await this.clearMatchFailure(m.matchId);
            } catch (err) {
              this.logger.warn(`Could not verify venue for match ${m.matchId}:`, err);
              matchErrorsCount++;

              const fallbackVenue = homeDbbId
                ? teamPrimaryVenueMap.get(homeDbbId)
                : null;

              venueId = fallbackVenue ?? existing?.venueId ?? null;
              isVerified = false;
            }
          }
        } else {
          // Tier 2: Distant Fixtures > 14 Days
          // Provisionally assign the home team's primaryVenueId WITHOUT making an N+1 fetchMatchInfo request
          if (existing?.isVenueVerified && !kickoffChanged) {
            venueId = existing.venueId;
            isVerified = true;
          } else {
            const primaryVenue = homeDbbId
              ? teamPrimaryVenueMap.get(homeDbbId)
              : null;

            venueId = primaryVenue ?? existing?.venueId ?? null;
            isVerified = false;
          }
        }

        if (isVerified) {
          verifiedMatchesCount++;
        } else {
          provisionalMatchesCount++;
        }

        matchRowsToUpsert.push({
          id: m.matchId,
          leagueId: dbLeague.id,
          matchDay: m.matchDay,
          matchNo: m.matchNo || null,
          kickoffDate: kickoffDateNormalized,
          kickoffTime: kickoffTimeNormalized,
          homeTeamId: homeId,
          guestTeamId: guestId,
          venueId,
          isVenueVerified: isVerified,
          result: m.result || null,
          confirmed: Boolean(m.ergebnisbestaetigt),
          rawData: m,
          updatedAt: new Date(),
        });
      }

      // 7. Batch Upsert Matches
      let syncedMatchesCount = 0;

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
              isVenueVerified: sql`excluded.is_venue_verified`,
              result: sql`coalesce(excluded.result, ${matches.result})`,
              confirmed: sql`excluded.confirmed`,
              rawData: sql`excluded.raw_data`,
              updatedAt: sql`excluded.updated_at`,
            },
          });

        syncedMatchesCount = matchRowsToUpsert.length;
      }

      // 8. Run majority voting for all teams with newly verified home matches
      for (const homeDbbId of verifiedHomeTeamDbbIds) {
        await this.recalculateTeamPrimaryVenue(homeDbbId);
      }

      await this.clearLeagueFailure(liganr);

      if (matchErrorsCount === 0) {
        await this.clearFailures(liganr);
      }

      const durationMs = Date.now() - startTime;
      const completionDate = new Date();

      this.lastSyncedAt = completionDate;
      await this.persistLastSyncedAt(completionDate);

      this.logger.log(
        `Delta-sync completed for league ${liganr} ("${leagueName}"): ` +
          `${syncedMatchesCount}/${windowMatches.length} matches ` +
          `(${verifiedMatchesCount} verified, ${provisionalMatchesCount} provisional), ` +
          `${syncedVenuesCount} venues (${geocodedVenuesCount} geocoded) in ${durationMs}ms.`
      );

      return {
        success: true,
        leagueId: ligaData.ligaId,
        leagueName,
        totalMatches: windowMatches.length,
        syncedMatches: syncedMatchesCount,
        matchesCount: syncedMatchesCount,
        verifiedMatches: verifiedMatchesCount,
        provisionalMatches: provisionalMatchesCount,
        syncedVenues: syncedVenuesCount,
        geocodedVenues: geocodedVenuesCount,
        durationMs,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error during delta-sync for league ${liganr}: ${errorMsg}`);

      await this.recordFailure({
        entityType: 'league',
        dbbLeagueId: liganr,
        leagueName,
        verbandId: options?.verbandId,
        errorMessage: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Synchronizes all active leagues for an association in parallel using bounded concurrency
   * and Two-Tier Delta-Sync.
   */
  async syncVerbandDelta(
    verbandId = 1,
    options?: SyncVerbandDeltaOptions
  ): Promise<SyncVerbandDeltaResult> {
    if (!this.db) {
      throw new Error(
        'Database is not configured! Please set DATABASE_URL in .env to persist scraped data.'
      );
    }

    const startTime = Date.now();
    const concurrency = options?.concurrency ?? 5;
    const throttleMs = options?.throttleMs ?? 0;
    const rangeDays = options?.rangeDays ?? 14;

    this.logger.log(
      `Starting delta-sync for Verband ${verbandId} ` +
        `(concurrency: ${concurrency}, rangeDays: ${rangeDays})...`
    );

    const allLeagues = await this.dbbClient.fetchLeagues(verbandId);

    this.logger.log(`Discovered ${allLeagues.length} leagues for Verband ${verbandId}.`);

    // Preload shared venue cache across all leagues
    const existingVenues = await this.db.select().from(venues);
    const venueCache = new Map<number, typeof venues.$inferSelect>();

    for (const v of existingVenues) {
      venueCache.set(v.id, v);
    }

    const venueInFlight = new Map<
      number,
      Promise<typeof venues.$inferSelect | null>
    >();

    let syncedMatches = 0;
    let successfulLeagues = 0;
    const errors: Array<{ leagueId: number; message: string }> = [];
    const leagueResults: DeltaSyncResult[] = [];

    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < allLeagues.length) {
        const index = nextIndex++;
        const league = allLeagues[index];

        try {
          const result = await this.syncLeagueDelta(league.ligaId, {
            rangeDays,
            venueCache,
            venueInFlight,
            verbandId,
            leagueName: league.liganame,
          });

          syncedMatches += result.syncedMatches;
          successfulLeagues++;
          leagueResults.push(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to delta-sync league ${league.ligaId} ("${league.liganame}"): ${message}`
          );
          errors.push({ leagueId: league.ligaId, message });
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
      `Verband ${verbandId} delta-sync completed in ${durationMs}ms: ` +
        `${successfulLeagues}/${allLeagues.length} leagues succeeded (${errors.length} failed), ` +
        `${syncedMatches} matches synced.`
    );

    return {
      durationMs,
      successfulLeagues,
      totalLeagues: allLeagues.length,
      syncedMatches,
      errors,
      leagueResults,
    };
  }

  /**
   * Delta-synchronizes all leagues in Baden-Württemberg (Verband ID 1).
   */
  async syncAllBawueDelta(options?: SyncVerbandDeltaOptions): Promise<SyncVerbandDeltaResult> {
    return this.syncVerbandDelta(1, options);
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
        await this.persistVenueCoordinates(venue.id, coords, this.db);
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

  /**
   * Persists resolved Venue coordinates and PostGIS point geometry.
   */
  async persistVenueCoordinates(
    venueId: number,
    coords: { latitude: number; longitude: number },
    db: DrizzleDb = this.db!
  ): Promise<typeof venues.$inferSelect | null> {
    const now = new Date();

    const updateValues = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      location: { lng: coords.longitude, lat: coords.latitude },
      geocodedAt: now,
      updatedAt: now,
    };

    const [updated] = await db
      .update(venues)
      .set(updateValues)
      .where(eq(venues.id, venueId))
      .returning();

    return updated ?? null;
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
    let geo: { latitude: number; longitude: number } | null = null;

    if (spielfeld.strasse || spielfeld.ort) {
      geo = await this.geocoder.geocodeAddress(
        spielfeld.strasse,
        spielfeld.plz,
        spielfeld.ort
      );
    }

    const baseVenueValues = {
      id: spielfeld.id,
      name: spielfeld.bezeichnung || 'Unbekannte Sporthalle',
      street: spielfeld.strasse || null,
      postalCode: spielfeld.plz || null,
      city: spielfeld.ort || null,
      rawData: spielfeld,
      updatedAt: new Date(),
    };

    const [insertedVenue] = await db
      .insert(venues)
      .values(baseVenueValues)
      .onConflictDoUpdate({
        target: venues.id,
        set: {
          name: spielfeld.bezeichnung || 'Unbekannte Sporthalle',
          street: spielfeld.strasse || null,
          postalCode: spielfeld.plz || null,
          city: spielfeld.ort || null,
          rawData: spielfeld,
          updatedAt: new Date(),
        },
      })
      .returning();

    let venueRecord = insertedVenue;

    if (geo) {
      const updated = await this.persistVenueCoordinates(spielfeld.id, geo, db);

      if (updated) {
        venueRecord = updated;
      }
    }

    venueCache.set(spielfeld.id, venueRecord);

    return {
      venue: venueRecord,
      synced: true,
      geocoded: Boolean(geo),
    };
  }

  /**
   * Resolves canonical DBB Team ID across seasonTeamId, teamCompetitionId, and teamPermanentId.
   */
  resolveDbbTeamId(t: DbbTeam | null | undefined): number | null {
    if (!t) {
      return null;
    }

    return t.seasonTeamId || t.teamCompetitionId || t.teamPermanentId || null;
  }

  private collectTeam(
    t: DbbTeam | null | undefined,
    map: Map<
      number,
      { dbbId: number; name: string; shortName?: string; clubId?: number; raw: unknown }
    >
  ) {
    const id = this.resolveDbbTeamId(t);

    if (id && !map.has(id)) {
      map.set(id, {
        dbbId: id,
        name: t!.teamname,
        shortName: t!.teamnameSmall,
        clubId: t!.clubId,
        raw: t,
      });
    }
  }

  private getTeamId(
    t: DbbTeam | null | undefined,
    idMap: Map<number, number>
  ): number | null {
    const id = this.resolveDbbTeamId(t);

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

  isSyncActive(): boolean {
    return this.isSyncRunning;
  }

  setSyncActiveForTesting(isActive: boolean, runId: number | null = null): void {
    this.isSyncRunning = isActive;
    this.activeSyncRunId = runId;
  }

  async getActiveSyncRun(): Promise<typeof syncRuns.$inferSelect | null> {
    if (!this.db) {
      return null;
    }

    try {
      const [active] = await this.db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.status, 'running'))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);

      return active ?? null;
    } catch (err) {
      this.logger.warn('Failed to query active sync run:', err);

      return null;
    }
  }

  async getRecentSyncRuns(
    limit = 20
  ): Promise<Array<typeof syncRuns.$inferSelect>> {
    if (!this.db) {
      return [];
    }

    try {
      return await this.db
        .select()
        .from(syncRuns)
        .orderBy(desc(syncRuns.startedAt))
        .limit(limit);
    } catch (err) {
      this.logger.warn('Failed to query recent sync runs:', err);

      return [];
    }
  }

  async executeAuditedSync(params: {
    type: 'delta' | 'deep' | 'manual';
    target: string;
  }): Promise<typeof syncRuns.$inferSelect> {
    if (this.isSyncRunning) {
      throw new ConflictException(
        `A sync run is already in progress (ID: #${this.activeSyncRunId ?? 'unknown'})`
      );
    }

    let runId = 0;
    const startedAt = new Date();

    if (this.db) {
      const [inserted] = await this.db
        .insert(syncRuns)
        .values({
          syncType: params.type,
          target: params.target,
          startedAt,
          status: 'running',
        })
        .returning();

      if (inserted) {
        runId = inserted.id;
      }
    }

    this.isSyncRunning = true;
    this.activeSyncRunId = runId;

    return this.runAuditedSyncInternal(runId, startedAt, params);
  }

  async triggerAuditedSync(params: {
    type: 'delta' | 'deep';
    target: string;
  }): Promise<{ success: boolean; runId: number; status: string }> {
    if (this.isSyncRunning) {
      throw new ConflictException(
        `A sync run is already in progress (ID: #${this.activeSyncRunId ?? 'unknown'})`
      );
    }

    let runId = 0;
    const startedAt = new Date();

    if (this.db) {
      const [inserted] = await this.db
        .insert(syncRuns)
        .values({
          syncType: params.type,
          target: params.target,
          startedAt,
          status: 'running',
        })
        .returning();

      if (inserted) {
        runId = inserted.id;
      }
    }

    this.isSyncRunning = true;
    this.activeSyncRunId = runId;

    // Run asynchronously in the background
    this.runAuditedSyncInternal(runId, startedAt, params).catch((err) => {
      this.logger.error(`Background sync run ${runId} encountered an error:`, err);
    });

    return {
      success: true,
      runId,
      status: 'running',
    };
  }

  private async runAuditedSyncInternal(
    runId: number,
    startedAt: Date,
    params: { type: 'delta' | 'deep' | 'manual'; target: string }
  ): Promise<typeof syncRuns.$inferSelect> {
    const startTime = startedAt.getTime();
    let totalLeagues = 0;
    let successfulLeagues = 0;
    let syncedMatches = 0;
    let geocodedVenues = 0;
    let failuresCount = 0;
    const failedLeagues: string[] = [];
    let errorMessage: string | null = null;
    let status: 'success' | 'partial' | 'error' = 'success';

    try {
      if (params.target === 'all') {
        const verbaende = getActiveVerbaende();

        for (const verband of verbaende) {
          try {
            if (params.type === 'delta') {
              const res = await this.syncVerbandDelta(verband.id);

              totalLeagues += res.totalLeagues;
              successfulLeagues += res.successfulLeagues;
              syncedMatches += res.syncedMatches;
              failuresCount += res.errors.length;

              if (res.errors.length > 0) {
                failedLeagues.push(
                  ...res.errors.map((e) => `Liga ${e.leagueId} (${verband.shortName})`)
                );
              }
            } else {
              const res = await this.syncVerbandLeagues(verband.id, {
                quickSync: false,
              });

              totalLeagues += res.totalLeagues;
              successfulLeagues += res.successfulLeagues;
              syncedMatches += res.syncedMatches;
              geocodedVenues += res.geocodedVenues;
              failuresCount += res.failedLeagues;
            }
          } catch (err) {
            this.logger.debug(
              `Skipped or failed association ${verband.id} (${verband.name}): ${err instanceof Error ? err.message : String(err)}`
            );
          }
        }
      } else if (params.target.startsWith('verband:')) {
        const verbandId = parseInt(params.target.split(':')[1], 10);

        if (params.type === 'delta') {
          const res = await this.syncVerbandDelta(verbandId);

          totalLeagues = res.totalLeagues;
          successfulLeagues = res.successfulLeagues;
          syncedMatches = res.syncedMatches;
          failuresCount = res.errors.length;

          if (res.errors.length > 0) {
            failedLeagues.push(...res.errors.map((e) => `Liga ${e.leagueId}`));
          }
        } else {
          const res = await this.syncVerbandLeagues(verbandId, {
            quickSync: false,
          });

          totalLeagues = res.totalLeagues;
          successfulLeagues = res.successfulLeagues;
          syncedMatches = res.syncedMatches;
          geocodedVenues = res.geocodedVenues;
          failuresCount = res.failedLeagues;
        }
      } else if (params.target.startsWith('league:')) {
        const leagueId = parseInt(params.target.split(':')[1], 10);
        totalLeagues = 1;

        try {
          const res = await this.syncLeague(leagueId, {
            quickSync: params.type === 'delta',
          });

          successfulLeagues = 1;
          syncedMatches = res.syncedMatches;
          geocodedVenues = res.geocodedVenues;
          failuresCount =
            res.totalMatches > res.syncedMatches
              ? res.totalMatches - res.syncedMatches
              : 0;
        } catch (leagueErr) {
          failuresCount = 1;
          failedLeagues.push(`Liga ${leagueId}`);
          errorMessage =
            leagueErr instanceof Error ? leagueErr.message : String(leagueErr);
        }
      } else {
        throw new Error(`Unsupported sync target: "${params.target}"`);
      }

      if (failuresCount > 0) {
        if (successfulLeagues > 0 || syncedMatches > 0) {
          status = 'partial';
        } else {
          status = 'error';
        }
      }
    } catch (err) {
      status = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error during audited sync (run ${runId}):`, err);
    } finally {
      this.isSyncRunning = false;
      this.activeSyncRunId = null;
    }

    const durationMs = Date.now() - startTime;
    const finishedAt = new Date();

    if (this.db && runId > 0) {
      try {
        await this.db
          .update(syncRuns)
          .set({
            finishedAt,
            durationMs,
            totalLeagues,
            successfulLeagues,
            syncedMatches,
            geocodedVenues,
            failuresCount,
            status,
            errorMessage,
          })
          .where(eq(syncRuns.id, runId));
      } catch (dbErr) {
        this.logger.warn(`Failed to update sync_runs row ${runId}:`, dbErr);
      }
    }

    if (this.telegramNotifier) {
      try {
        await this.telegramNotifier.updateLiveStatus({
          status,
          startedAt,
          finishedAt,
          durationMs,
          syncedMatches,
          failuresCount,
          failedLeagues,
          errorMessage,
        });
      } catch (tgErr) {
        this.logger.warn('Failed to send Telegram notification:', tgErr);
      }
    }

    return {
      id: runId,
      syncType: params.type,
      target: params.target,
      startedAt,
      finishedAt,
      durationMs,
      totalLeagues,
      successfulLeagues,
      syncedMatches,
      geocodedVenues,
      failuresCount,
      status,
      errorMessage,
      createdAt: startedAt,
    };
  }
}
