import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  aliasedTable,
  and,
  asc,
  eq,
  gte,
  ilike,
  isNull,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import type {
  FeatureMatchDto,
  League,
  Match,
  PaginatedMatchesResponse,
  TopMatchMeta,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  LeagueRawData,
  leagues,
  matches,
  teams,
  venues,
} from '../database/schema';
import { TelegramNotifierService } from './telegram-notifier.service';
import { verifyAdminToken } from '../submissions/submissions.service';

export { verifyAdminToken };

export interface AdminRelationalMatchRow {
  match: {
    id: number;
    leagueId: number;
    matchDay: number;
    matchNo?: number | null;
    kickoffDate?: string | null;
    kickoffTime?: string | null;
    result?: string | null;
    confirmed: boolean;
    admissionFee?: string | null;
    kioskDescription?: string | null;
    parkingNotes?: string | null;
    matchNotes?: string | null;
    isFeatured?: boolean;
    featuredUntil?: Date | string | null;
    featuredReason?: string | null;
    featuredMeta?: unknown;
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
    geocodedAt?: Date | string | null;
    kioskDescription?: string | null;
    parkingNotes?: string | null;
  } | null;
}

@Injectable()
export class AdminService {
  constructor(
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    @Optional() private readonly telegramNotifier?: TelegramNotifierService
  ) {}

  verifyToken(token?: string, authHeader?: string): void {
    verifyAdminToken(token, authHeader);
  }

  private mapLeague(league: NonNullable<AdminRelationalMatchRow['league']>): League {
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

  mapAdminMatchRow(row: AdminRelationalMatchRow): Match {
    let featuredUntilIso: string | null = null;

    if (row.match.featuredUntil instanceof Date) {
      featuredUntilIso = row.match.featuredUntil.toISOString();
    } else if (row.match.featuredUntil) {
      featuredUntilIso = String(row.match.featuredUntil);
    }

    let geocodedAtIso: string | null = null;

    if (row.venue?.geocodedAt instanceof Date) {
      geocodedAtIso = row.venue.geocodedAt.toISOString();
    } else if (row.venue?.geocodedAt) {
      geocodedAtIso = String(row.venue.geocodedAt);
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
            geocodedAt: geocodedAtIso,
            kioskDescription: row.venue.kioskDescription ?? undefined,
            parkingNotes: row.venue.parkingNotes ?? undefined,
          }
        : null,
      result: row.match.result ?? null,
      confirmed: row.match.confirmed,
      admissionFee: row.match.admissionFee ?? undefined,
      kioskDescription:
        row.match.kioskDescription ?? row.venue?.kioskDescription ?? undefined,
      parkingNotes:
        row.match.parkingNotes ?? row.venue?.parkingNotes ?? undefined,
      matchNotes: row.match.matchNotes ?? undefined,
      isFeatured: Boolean(row.match.isFeatured),
      featuredUntil: featuredUntilIso,
      featuredReason: row.match.featuredReason ?? undefined,
      // SAFETY: DB jsonb featured_meta stores TopMatchMeta
      featuredMeta: (row.match.featuredMeta as TopMatchMeta) ?? undefined,
    };
  }

  /**
   * Search matches for Admin Featured Match management by home team, guest team, league, or match ID.
   */
  async searchMatches(query?: string): Promise<Match[]> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const trimmed = query ? query.trim() : '';

    if (!trimmed) {
      return [];
    }

    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');
    const tokens = trimmed.split(/\s+/).filter(Boolean);

    const tokenConditions = tokens.map((token) => {
      const pattern = `%${token}%`;

      const orClauses: SQL[] = [
        ilike(homeTeam.name, pattern),
        ilike(homeTeam.shortName, pattern),
        ilike(guestTeam.name, pattern),
        ilike(guestTeam.shortName, pattern),
        ilike(leagues.name, pattern),
        ilike(sql`coalesce(${leagues.skName}, ${leagues.rawData}->>'skName')`, pattern),
        ilike(sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`, pattern),
        ilike(venues.name, pattern),
        ilike(venues.city, pattern),
      ];

      if (/^\d+$/.test(token)) {
        const numericId = parseInt(token, 10);

        if (!Number.isNaN(numericId)) {
          orClauses.push(eq(matches.id, numericId));
        }
      }

      return or(...orClauses)!;
    });

    const rows = await this.db
      .select({
        match: matches,
        league: leagues,
        homeTeam,
        guestTeam,
        venue: venues,
      })
      .from(matches)
      .innerJoin(leagues, eq(matches.leagueId, leagues.id))
      .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .innerJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
      .leftJoin(venues, eq(matches.venueId, venues.id))
      .where(and(...tokenConditions))
      .orderBy(asc(matches.kickoffDate), asc(matches.kickoffTime))
      .limit(50);

    return rows.map((row) => this.mapAdminMatchRow(row));
  }

  /**
   * Lists active Featured Matches (`is_featured = true` and not yet expired) with server-side pagination and search.
   */
  async getFeaturedMatches(options?: {
    page?: number;
    limit?: number;
    query?: string;
  }): Promise<PaginatedMatchesResponse> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const page = Math.max(1, Math.floor(Number(options?.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(options?.limit) || 25)));
    const offset = (page - 1) * limit;

    const now = new Date();
    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    const conditions: SQL[] = [
      eq(matches.isFeatured, true),
      or(isNull(matches.featuredUntil), gte(matches.featuredUntil, now))!,
    ];

    const trimmed = options?.query ? options.query.trim() : '';

    if (trimmed) {
      const tokens = trimmed.split(/\s+/).filter(Boolean);

      const tokenConditions = tokens.map((token) => {
        const pattern = `%${token}%`;

        const orClauses: SQL[] = [
          ilike(homeTeam.name, pattern),
          ilike(homeTeam.shortName, pattern),
          ilike(guestTeam.name, pattern),
          ilike(guestTeam.shortName, pattern),
          ilike(leagues.name, pattern),
          ilike(sql`coalesce(${leagues.skName}, ${leagues.rawData}->>'skName')`, pattern),
          ilike(sql`coalesce(${leagues.akName}, ${leagues.rawData}->>'akName')`, pattern),
          ilike(venues.name, pattern),
          ilike(venues.city, pattern),
        ];

        if (/^\d+$/.test(token)) {
          const numericId = parseInt(token, 10);

          if (!Number.isNaN(numericId)) {
            orClauses.push(eq(matches.id, numericId));
          }
        }

        return or(...orClauses)!;
      });

      conditions.push(...tokenConditions);
    }

    const whereClause = and(...conditions);

    const [countResult, rows] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(matches)
        .innerJoin(leagues, eq(matches.leagueId, leagues.id))
        .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
        .innerJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
        .leftJoin(venues, eq(matches.venueId, venues.id))
        .where(whereClause),
      this.db
        .select({
          match: matches,
          league: leagues,
          homeTeam,
          guestTeam,
          venue: venues,
        })
        .from(matches)
        .innerJoin(leagues, eq(matches.leagueId, leagues.id))
        .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
        .innerJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
        .leftJoin(venues, eq(matches.venueId, venues.id))
        .where(whereClause)
        .orderBy(asc(matches.kickoffDate), asc(matches.kickoffTime))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count ? Number(countResult[0].count) : 0;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return {
      data: rows.map((row) => this.mapAdminMatchRow(row)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Toggles the Featured Match status for a given match ID.
   * When `isFeatured: true`: sets `is_featured = true` and `featured_until = NOW() + 7 days` (default).
   * When `isFeatured: false`: resets `is_featured = false` and `featured_until = null`.
   */
  async featureMatch(matchId: number, dto: FeatureMatchDto): Promise<Match> {
    if (!dto || (dto.isFeatured !== true && dto.isFeatured !== false)) {
      throw new BadRequestException('isFeatured boolean is required');
    }

    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const now = new Date();

    const durationDays =
      dto.durationDays !== undefined &&
      dto.durationDays !== null &&
      !Number.isNaN(Number(dto.durationDays)) &&
      Number(dto.durationDays) > 0
        ? Number(dto.durationDays)
        : 7;

    const featuredUntil = dto.isFeatured
      ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)
      : null;

    const featuredReason = dto.isFeatured ? 'Von Admin ausgewählt' : null;
    const featuredMeta = dto.isFeatured ? { type: 'admin' } : null;

    const [updated] = await this.db
      .update(matches)
      .set({
        isFeatured: dto.isFeatured,
        featuredUntil,
        featuredReason,
        featuredMeta,
        updatedAt: now,
      })
      .where(eq(matches.id, matchId))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    try {
      const relationalRows = await this.db
        .select({
          match: matches,
          league: leagues,
          homeTeam,
          guestTeam,
          venue: venues,
        })
        .from(matches)
        .innerJoin(leagues, eq(matches.leagueId, leagues.id))
        .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
        .innerJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
        .leftJoin(venues, eq(matches.venueId, venues.id))
        .where(eq(matches.id, matchId))
        .limit(1);

      const firstRow = relationalRows?.[0];

      if (firstRow && firstRow.match && firstRow.homeTeam && firstRow.guestTeam) {
        return this.mapAdminMatchRow({
          ...firstRow,
          match: {
            ...firstRow.match,
            isFeatured: updated.isFeatured,
            featuredUntil: updated.featuredUntil,
          },
        });
      }
    } catch {
      // Fall back to direct updated match row if relational select is unavailable
    }

    return {
      id: updated.id,
      leagueId: updated.leagueId,
      matchDay: updated.matchDay,
      matchNo: updated.matchNo ?? undefined,
      kickoffDate: updated.kickoffDate ?? null,
      kickoffTime: updated.kickoffTime ?? null,
      homeTeam: {
        id: updated.homeTeamId,
        dbbId: updated.homeTeamId,
        name: `Team #${updated.homeTeamId}`,
      },
      guestTeam: {
        id: updated.guestTeamId,
        dbbId: updated.guestTeamId,
        name: `Team #${updated.guestTeamId}`,
      },
      venue: null,
      result: updated.result ?? null,
      confirmed: Boolean(updated.confirmed),
      admissionFee: updated.admissionFee ?? undefined,
      kioskDescription: updated.kioskDescription ?? undefined,
      parkingNotes: updated.parkingNotes ?? undefined,
      matchNotes: updated.matchNotes ?? undefined,
      isFeatured: Boolean(updated.isFeatured),
      featuredUntil:
        updated.featuredUntil instanceof Date
          ? updated.featuredUntil.toISOString()
          : (updated.featuredUntil ?? null),
      featuredReason: updated.featuredReason ?? undefined,
      // SAFETY: DB jsonb featured_meta stores TopMatchMeta
      featuredMeta: (updated.featuredMeta as TopMatchMeta) ?? undefined,
    };
  }

  async toggleMatchFeature(matchId: number, dto: FeatureMatchDto): Promise<Match> {
    return this.featureMatch(matchId, dto);
  }
}
