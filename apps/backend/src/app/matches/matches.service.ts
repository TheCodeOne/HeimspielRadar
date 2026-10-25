import { Inject, Injectable, Logger } from '@nestjs/common';
import { aliasedTable, and, asc, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import { League, Match, NearbyMatchesQuery, TeamSuggestion } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { LeagueRawData, leagues, matches, teams, venues } from '../database/schema';

export interface RelationalMatchRow {
  match: {
    id: number;
    leagueId: number;
    matchDay: number;
    matchNo?: number | null;
    kickoffDate?: string | null;
    kickoffTime?: string | null;
    result?: string | null;
    confirmed: boolean;
  };
  league?: {
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
  } | null;
  homeTeam: {
    id: number;
    dbbId: number;
    name: string;
    shortName?: string | null;
    clubId?: number | null;
  };
  guestTeam: {
    id: number;
    dbbId: number;
    name: string;
    shortName?: string | null;
    clubId?: number | null;
  };
  venue?: {
    id: number;
    name: string;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    geocodedAt?: Date | null;
  } | null;
  distanceKm?: number | string | null;
}

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
   * Search teams matching a search query for autocomplete suggestions.
   * Disambiguates multiple teams of the same club by aggregating across age classes
   * and gender dimensions to eliminate duplicate entries (e.g. MTV Stuttgart U12 vs U14).
   */
  async findTeamSuggestions(query: string): Promise<TeamSuggestion[]> {
    if (!this.db) {
      throw new Error('Database is not configured! Please configure DATABASE_URL in .env.');
    }

    const trimmed = query.trim();

    if (!trimmed) {
      return [];
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    // Each token can match against team name, short name, age group (akName) or gender (geschlecht)
    const tokenConditions = tokens.map((token) => {
      const pattern = `%${token}%`;

      return or(
        ilike(teams.name, pattern),
        ilike(teams.shortName, pattern),
        ilike(sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`, pattern),
        ilike(sql`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`, pattern)
      )!;
    });

    const rows = await this.db
      .select({
        id: sql<number>`min(${teams.id})`,
        name: teams.name,
        shortName: sql<string | null>`min(${teams.shortName})`,
        clubId: sql<number | null>`min(${teams.clubId})`,
        akName: sql<string | null>`min(coalesce(${leagues.akName}, ${leagues.rawData}->>'akName'))`,
        geschlecht: sql<string | null>`min(coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht'))`,
      })
      .from(teams)
      .leftJoin(leagues, eq(teams.leagueId, leagues.id))
      .where(and(...tokenConditions))
      .groupBy(
        teams.name,
        sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`,
        sql`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`
      )
      .orderBy(
        asc(teams.name),
        asc(sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`),
        asc(sql`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`)
      )
      .limit(20);

    return rows;
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
      dateFrom,
      dateTo,
      teamQuery,
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

    const trimmedTeam = teamQuery?.trim();

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

    if (dateFrom) {
      conditions.push(gte(matches.kickoffDate, dateFrom));
    }

    if (dateTo) {
      conditions.push(lte(matches.kickoffDate, dateTo));
    }

    if (onlyUpcoming) {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const berlinParts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(cutoff);

      const [cutoffDateStr, cutoffTimeStr] = berlinParts.split(' ');

      conditions.push(
        sql`(${matches.result} IS NULL OR btrim(${matches.result}) = '')`
      );
      conditions.push(
        sql`(${matches.kickoffDate} > ${cutoffDateStr} OR (${matches.kickoffDate} = ${cutoffDateStr} AND (${matches.kickoffTime} IS NULL OR btrim(${matches.kickoffTime}) = '' OR ${matches.kickoffTime} = '00:00' OR ${matches.kickoffTime} > ${cutoffTimeStr})))`
      );
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

    if (trimmedTeam) {
      const numMatch = trimmedTeam.match(/^(.*?)(?:\s+(\d+)|\s*\((\d+)\))$/);
      const queryNum = numMatch ? parseInt(numMatch[2] ?? numMatch[3], 10) : undefined;
      const queryBase = (numMatch ? numMatch[1] : trimmedTeam).trim();
      const searchPhrase = queryNum !== undefined ? queryBase : trimmedTeam;
      const reserveSuffixRegex = '(\\s+([2-9]|\\d{2,})|\\(([2-9]|\\d{2,})\\))$';

      const buildTeamValidity = (teamTable: typeof homeTeam) => {
        if (queryNum === 1) {
          return sql`NOT (${teamTable.name} ~* ${reserveSuffixRegex})`;
        }

        if (queryNum !== undefined && queryNum >= 2) {
          return sql`${teamTable.name} ~* ('(\\s+' || ${queryNum} || '|\\(' || ${queryNum} || '\\))$')`;
        }

        return sql`NOT (
          ${teamTable.name} ~* ${reserveSuffixRegex}
          AND lower(${trimmedTeam}) LIKE ('%' || lower(btrim(regexp_replace(${teamTable.name}, ${reserveSuffixRegex}, ''))) || '%')
        )`;
      };

      const homeReserveValid = buildTeamValidity(homeTeam);
      const guestReserveValid = buildTeamValidity(guestTeam);

      const fullPhraseCondition = or(
        and(
          or(
            ilike(homeTeam.name, `%${searchPhrase}%`),
            ilike(homeTeam.shortName, `%${searchPhrase}%`)
          ),
          homeReserveValid
        ),
        and(
          or(
            ilike(guestTeam.name, `%${searchPhrase}%`),
            ilike(guestTeam.shortName, `%${searchPhrase}%`)
          ),
          guestReserveValid
        )
      )!;

      const tokens = searchPhrase.split(/\s+/).filter(Boolean);

      if (tokens.length <= 1) {
        conditions.push(fullPhraseCondition);
      } else {
        const tokenConditions = tokens.map((tok) => {
          const pat = `%${tok}%`;

          return or(
            and(
              or(
                ilike(homeTeam.name, pat),
                ilike(homeTeam.shortName, pat)
              ),
              homeReserveValid
            ),
            and(
              or(
                ilike(guestTeam.name, pat),
                ilike(guestTeam.shortName, pat)
              ),
              guestReserveValid
            ),
            ilike(sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`, pat),
            ilike(sql`coalesce(${leagues.geschlecht}, ${leagues.rawData}->>'geschlecht')`, pat)
          )!;
        });

        conditions.push(or(fullPhraseCondition, and(...tokenConditions)!)!);
      }
    }

    let distanceKmSql: SQL<number | null> | undefined;

    if (hasSpatialCoords) {
      const originPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;

      distanceKmSql = sql<number>`round((ST_Distance(${venues.location}, ${originPoint}) / 1000.0)::numeric, 1)`;

      if (!trimmedTeam) {
        const radiusMeters = radiusKm * 1000;

        conditions.push(
          sql`ST_DWithin(${venues.location}, ${originPoint}, ${radiusMeters})`
        );
      }
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

    if (!trimmedTeam && hasSpatialCoords && distanceKmSql) {
      queryBuilder.orderBy(
        distanceKmSql,
        asc(matches.kickoffDate),
        asc(matches.kickoffTime)
      );
    } else {
      queryBuilder.orderBy(
        asc(matches.kickoffDate),
        asc(matches.kickoffTime)
      );
    }

    const rows = await queryBuilder;

    return rows.map((r) =>
      this.mapRelationalMatch({
        match: r.match,
        league: r.league,
        homeTeam: r.homeTeam,
        guestTeam: r.guestTeam,
        venue: r.venue,
        distanceKm: r.distanceKm,
      })
    );
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

    return this.mapRelationalMatch({
      match: row,
      league: row.league,
      homeTeam: row.homeTeam,
      guestTeam: row.guestTeam,
      venue: row.venue,
    });
  }

  /**
   * Maps a relational match row with homeTeam, guestTeam, venue, and optional league into domain Match DTO.
   */
  mapRelationalMatch(row: RelationalMatchRow): Match {
    let distanceKm: number | undefined;

    if (row.distanceKm !== null && row.distanceKm !== undefined) {
      distanceKm = Number(row.distanceKm);
    }

    return {
      id: row.match.id,
      leagueId: row.match.leagueId,
      league: row.league ? this.mapLeague(row.league) : undefined,
      matchDay: row.match.matchDay,
      matchNo: row.match.matchNo ?? undefined,
      kickoffDate: row.match.kickoffDate ?? null,
      kickoffTime: row.match.kickoffTime ?? null,
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
            latitude: row.venue.latitude ?? null,
            longitude: row.venue.longitude ?? null,
            geocodedAt: row.venue.geocodedAt ? row.venue.geocodedAt.toISOString() : null,
          }
        : null,
      result: row.match.result ?? null,
      confirmed: row.match.confirmed,
      distanceKm,
    };
  }

  mapLeague(league: {
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

