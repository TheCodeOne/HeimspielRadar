import { Inject, Injectable, Logger } from '@nestjs/common';
import { aliasedTable, and, asc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { League, Match, NearbyMatchesQuery } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { LeagueRawData, leagues, matches, teams, venues } from '../database/schema';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  /**
   * Retrieve all synced leagues ordered alphabetically by name,
   * using COALESCE fallback to raw_data JSON fields for backward compatibility.
   */
  async findAllLeagues(): Promise<League[]> {
    if (!this.db) {
      throw new Error('Database is not configured! Please configure DATABASE_URL in .env.');
    }

    const rows = await this.db
      .select({
        id: leagues.id,
        dbbId: leagues.dbbId,
        name: leagues.name,
        seasonId: leagues.seasonId,
        seasonName: leagues.seasonName,
        verbandName: leagues.verbandName,
        skName: sql<string | null>`coalesce(${leagues.skName}, ${leagues.rawData}->>'skName')`,
        akName: sql<string | null>`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`,
        geschlecht: sql<string | null>`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`,
        rawData: leagues.rawData,
      })
      .from(leagues)
      .orderBy(asc(leagues.name));

    return rows.map((r) => this.mapLeague(r));
  }

  /**
   * Search matches for map display by date, coordinates (lat/lng), radius in km, or league dimensions.
   * Uses native PostGIS ST_DWithin and ST_Distance when spatial coordinates are provided,
   * with fallback to standard attribute filtering when coordinates are null or omitted.
   */
  async findMatches(query: NearbyMatchesQuery): Promise<Match[]> {
    if (!this.db) {
      throw new Error('Database is not configured! Please configure DATABASE_URL in .env.');
    }

    const {
      date,
      lat,
      lng,
      radiusKm = 30,
      leagueId,
      leagueIds,
      genders,
      ageClasses,
      skillLevels,
      onlyUpcoming,
    } = query;

    const hasSpatialCoords =
      lat !== undefined &&
      lat !== null &&
      lng !== undefined &&
      lng !== null &&
      !isNaN(lat) &&
      !isNaN(lng);

    const conditions: SQL[] = [];

    if (date) {
      conditions.push(eq(matches.kickoffDate, date));
    }

    if (onlyUpcoming) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      conditions.push(
        sql`(${matches.result} IS NULL OR btrim(${matches.result}) = '')`
      );
      conditions.push(sql`${matches.kickoffDate} >= ${todayStr}`);
    }

    if (leagueId) {
      conditions.push(eq(matches.leagueId, leagueId));
    }

    if (leagueIds && leagueIds.length > 0) {
      conditions.push(inArray(matches.leagueId, leagueIds));
    }

    if (genders && genders.length > 0) {
      conditions.push(
        inArray(
          sql`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`,
          genders
        )
      );
    }

    if (ageClasses && ageClasses.length > 0) {
      conditions.push(
        inArray(
          sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`,
          ageClasses
        )
      );
    }

    if (skillLevels && skillLevels.length > 0) {
      conditions.push(
        inArray(
          sql`coalesce(${leagues.skName}, ${leagues.rawData}->>'skName')`,
          skillLevels
        )
      );
    }

    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    let distanceKmSql: SQL<number | null> | undefined;

    if (hasSpatialCoords) {
      const radiusMeters = radiusKm * 1000;
      const originPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

      distanceKmSql = sql<number>`round((ST_Distance(${venues.location}, ${originPoint}) / 1000.0)::numeric, 1)`;

      conditions.push(
        sql`ST_DWithin(${venues.location}, ${originPoint}, ${radiusMeters})`
      );
    }

    const queryBuilder = this.db
      .select({
        match: matches,
        league: leagues,
        homeTeam,
        guestTeam,
        venue: venues,
        distanceKm: distanceKmSql ?? sql<null>`null`,
      })
      .from(matches)
      .innerJoin(leagues, eq(matches.leagueId, leagues.id))
      .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .innerJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
      .leftJoin(venues, eq(matches.venueId, venues.id));

    if (conditions.length > 0) {
      queryBuilder.where(and(...conditions));
    }

    if (hasSpatialCoords && distanceKmSql) {
      queryBuilder.orderBy(distanceKmSql);
    }

    const rows = await queryBuilder;

    return rows.map((r) => {
      let distanceKm: number | undefined;

      if (r.distanceKm !== null && r.distanceKm !== undefined) {
        distanceKm = Number(r.distanceKm);
      }

      return {
        id: r.match.id,
        leagueId: r.match.leagueId,
        league: r.league ? this.mapLeague(r.league) : undefined,
        matchDay: r.match.matchDay,
        matchNo: r.match.matchNo ?? undefined,
        kickoffDate: r.match.kickoffDate,
        kickoffTime: r.match.kickoffTime ?? '00:00',
        homeTeam: {
          id: r.homeTeam.id,
          dbbId: r.homeTeam.dbbId,
          name: r.homeTeam.name,
          shortName: r.homeTeam.shortName ?? undefined,
          clubId: r.homeTeam.clubId ?? undefined,
        },
        guestTeam: {
          id: r.guestTeam.id,
          dbbId: r.guestTeam.dbbId,
          name: r.guestTeam.name,
          shortName: r.guestTeam.shortName ?? undefined,
          clubId: r.guestTeam.clubId ?? undefined,
        },
        venue: r.venue
          ? {
              id: r.venue.id,
              name: r.venue.name,
              street: r.venue.street ?? '',
              postalCode: r.venue.postalCode ?? '',
              city: r.venue.city ?? '',
              latitude: r.venue.latitude,
              longitude: r.venue.longitude,
              geocodedAt: r.venue.geocodedAt ? r.venue.geocodedAt.toISOString() : null,
            }
          : null,
        result: r.match.result,
        confirmed: r.match.confirmed,
        distanceKm,
      };
    });
  }

  /**
   * Find single match by ID.
   */
  async findById(matchId: number): Promise<Match | null> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const row = await this.db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        league: true,
        homeTeam: true,
        guestTeam: true,
        venue: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      leagueId: row.leagueId,
      league: row.league ? this.mapLeague(row.league) : undefined,
      matchDay: row.matchDay,
      matchNo: row.matchNo ?? undefined,
      kickoffDate: row.kickoffDate,
      kickoffTime: row.kickoffTime ?? '00:00',
      homeTeam: {
        id: row.homeTeam.id,
        dbbId: row.homeTeam.dbbId,
        name: row.homeTeam.name,
        shortName: row.homeTeam.shortName ?? undefined,
        clubId: row.homeTeam.clubId ?? undefined,
      },
      guestTeam: {
        id: row.guestTeam.id,
        dbbId: row.guestTeam.dbbId,
        name: row.guestTeam.name,
        shortName: row.guestTeam.shortName ?? undefined,
        clubId: row.guestTeam.clubId ?? undefined,
      },
      venue: row.venue
        ? {
            id: row.venue.id,
            name: row.venue.name,
            street: row.venue.street ?? '',
            postalCode: row.venue.postalCode ?? '',
            city: row.venue.city ?? '',
            latitude: row.venue.latitude,
            longitude: row.venue.longitude,
            geocodedAt: row.venue.geocodedAt ? row.venue.geocodedAt.toISOString() : null,
          }
        : null,
      result: row.result,
      confirmed: row.confirmed,
    };
  }

  private mapLeague(league: {
    id: number;
    dbbId?: number;
    name: string;
    seasonId?: number | null;
    seasonName?: string | null;
    verbandName?: string | null;
    skName?: string | null;
    akName?: string | null;
    geschlecht?: string | null;
    rawData?: LeagueRawData | null;
  }): League {
    return {
      id: league.id,
      dbbId: league.dbbId ?? league.id,
      name: league.name,
      seasonId: league.seasonId ?? undefined,
      seasonName: league.seasonName ?? undefined,
      verbandName: league.verbandName ?? undefined,
      skName: league.skName ?? league.rawData?.skName ?? undefined,
      akName: league.akName ?? league.rawData?.akName ?? undefined,
      geschlecht: league.geschlecht ?? league.rawData?.geschlecht ?? undefined,
    };
  }

  /**
   * Haversine formula to compute great-circle distance between two points in kilometers.
   */
  calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 10) / 10; // Round to 1 decimal place (e.g. 14.2 km)
  }
}

