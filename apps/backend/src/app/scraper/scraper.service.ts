import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { SyncResult } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { leagues, matches, teams, venues } from '../database/schema';
import { DbbClientService, DbbMatch, DbbTeam } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

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
      } catch (e) {
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
  async syncLeague(ligaId: number): Promise<SyncResult> {
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

    // 3. Sync Matches and Venues (Gyms)
    let geocodedVenuesCount = 0;
    let syncedVenuesCount = 0;
    let syncedMatchesCount = 0;

    // Load all existing venues into cache to avoid duplicate DB calls & geocoding
    const existingVenues = await this.db.select().from(venues);
    const venueCache = new Map<number, typeof venues.$inferSelect>();
    for (const v of existingVenues) {
      venueCache.set(v.id, v);
    }

    for (const m of rawMatches) {
      let venueId: number | null = null;

      // Fetch venue details from matchInfo
      try {
        const info = await this.dbbClient.fetchMatchInfo(m.matchId);
        const spielfeld = info.data?.matchInfo?.spielfeld;

        if (spielfeld && spielfeld.id) {
          venueId = spielfeld.id;

          if (!venueCache.has(spielfeld.id)) {
            // Geocode new venue
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

            const [insertedVenue] = await this.db
              .insert(venues)
              .values({
                id: spielfeld.id,
                name: spielfeld.bezeichnung || 'Unbekannte Sporthalle',
                street: spielfeld.strasse || null,
                postalCode: spielfeld.plz || null,
                city: spielfeld.ort || null,
                latitude: lat,
                longitude: lng,
                geocodedAt: lat ? new Date() : null,
                rawData: spielfeld,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: venues.id,
                set: {
                  name: spielfeld.bezeichnung,
                  street: spielfeld.strasse,
                  postalCode: spielfeld.plz,
                  city: spielfeld.ort,
                  latitude: lat,
                  longitude: lng,
                  geocodedAt: lat ? new Date() : null,
                  updatedAt: new Date(),
                },
              })
              .returning();

            venueCache.set(spielfeld.id, insertedVenue);
            syncedVenuesCount++;
          }
        }
      } catch (err) {
        this.logger.warn(`Could not fetch matchInfo for match ${m.matchId}:`, err);
      }

      const homeId = this.getTeamId(m.homeTeam, teamDbIdMap);
      const guestId = this.getTeamId(m.guestTeam, teamDbIdMap);

      if (homeId && guestId) {
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
            confirmed: !!m.ergebnisbestaetigt,
            rawData: m,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: matches.id,
            set: {
              kickoffDate: m.kickoffDate,
              kickoffTime: m.kickoffTime || '00:00',
              result: m.result || null,
              confirmed: !!m.ergebnisbestaetigt,
              venueId: venueId,
              rawData: m,
              updatedAt: new Date(),
            },
          });

        syncedMatchesCount++;
      }
    }

    const durationMs = Date.now() - startTime;
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
}
