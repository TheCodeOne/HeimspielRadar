import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import {
  aliasedTable,
  and,
  asc,
  desc,
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
  VenueSubmission,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  LeagueRawData,
  leagues,
  matches,
  teams,
  venues,
  venueSubmissions,
} from '../database/schema';
import { TelegramNotifierService } from './telegram-notifier.service';

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
    matchNotes?: string | null;
    isFeatured?: boolean;
    featuredUntil?: Date | string | null;
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

export interface MatchModerationPatch {
  admissionFee?: string | null;
  matchNotes?: string | null;
  updatedAt: Date;
}

export interface VenueModerationPatch {
  kioskDescription?: string | null;
  parkingNotes?: string | null;
  updatedAt: Date;
}

export interface AdminRelationalSubmissionRow {
  submission: typeof venueSubmissions.$inferSelect;
  match?: {
    id: number;
    leagueId: number;
    kickoffDate?: string | null;
    kickoffTime?: string | null;
    homeTeamId?: number;
    guestTeamId?: number;
  } | null;
  league?: {
    id: number;
    name: string;
  } | null;
  homeTeam?: {
    id: number;
    name: string;
    shortName?: string | null;
  } | null;
  guestTeam?: {
    id: number;
    name: string;
    shortName?: string | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
  } | null;
}

export function verifyAdminToken(token?: string, authHeader?: string): void {
  const expectedSecret =
    process.env['ADMIN_API_SECRET'] || process.env['ADMIN_TOKEN'];

  let providedToken = token ? token.trim() : '';

  if (!providedToken && authHeader) {
    const trimmedHeader = authHeader.trim();

    if (trimmedHeader.startsWith('Bearer ')) {
      providedToken = trimmedHeader.slice('Bearer '.length).trim();
    } else {
      providedToken = trimmedHeader;
    }
  }

  if (!expectedSecret) {
    if (
      process.env['NODE_ENV'] === 'production' &&
      process.env['ENABLE_ADMIN_API'] !== 'true'
    ) {
      throw new UnauthorizedException('Admin secret is not configured on the server');
    }

    return;
  }

  if (!providedToken || providedToken !== expectedSecret) {
    throw new UnauthorizedException('Invalid or missing admin token');
  }
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

  mapAdminSubmissionRow(row: AdminRelationalSubmissionRow): VenueSubmission {
    const sub = row.submission;

    const createdAtIso =
      sub.createdAt instanceof Date
        ? sub.createdAt.toISOString()
        : String(sub.createdAt);

    const updatedAtIso =
      sub.updatedAt instanceof Date
        ? sub.updatedAt.toISOString()
        : String(sub.updatedAt);

    return {
      id: sub.id,
      matchId: sub.matchId ?? null,
      venueId: sub.venueId ?? null,
      submitterName: sub.submitterName ?? null,
      submitterRole: sub.submitterRole ?? null,
      submittedData: sub.submittedData ?? {},
      status: sub.status,
      createdAt: createdAtIso,
      updatedAt: updatedAtIso,
      match: row.match
        ? {
            id: row.match.id,
            leagueId: row.match.leagueId,
            leagueName: row.league?.name ?? null,
            kickoffDate: row.match.kickoffDate ?? null,
            kickoffTime: row.match.kickoffTime ?? null,
            homeTeam:
              row.homeTeam?.name ?? `Team #${row.match.homeTeamId ?? ''}`,
            guestTeam:
              row.guestTeam?.name ?? `Team #${row.match.guestTeamId ?? ''}`,
          }
        : null,
      venue: row.venue
        ? {
            id: row.venue.id,
            name: row.venue.name,
            street: row.venue.street ?? null,
            postalCode: row.venue.postalCode ?? null,
            city: row.venue.city ?? null,
          }
        : null,
    };
  }

  /**
   * Lists venue/kiosk submissions with joined match (home, guest, league, date) and venue context,
   * optionally filtered by status ('pending' | 'approved' | 'rejected' | 'all').
   */
  async getSubmissions(status?: string): Promise<VenueSubmission[]> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const normalized = status ? status.trim().toLowerCase() : 'all';

    if (
      normalized !== 'all' &&
      normalized !== 'pending' &&
      normalized !== 'approved' &&
      normalized !== 'rejected'
    ) {
      throw new BadRequestException(
        `Invalid status filter "${status}". Allowed values: pending, approved, rejected, all`
      );
    }

    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    const baseQuery = this.db
      .select({
        submission: venueSubmissions,
        match: matches,
        league: leagues,
        homeTeam,
        guestTeam,
        venue: venues,
      })
      .from(venueSubmissions)
      .leftJoin(matches, eq(venueSubmissions.matchId, matches.id))
      .leftJoin(leagues, eq(matches.leagueId, leagues.id))
      .leftJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
      .leftJoin(guestTeam, eq(matches.guestTeamId, guestTeam.id))
      .leftJoin(venues, eq(venueSubmissions.venueId, venues.id));

    const filteredQuery =
      normalized === 'all'
        ? baseQuery
        : baseQuery.where(eq(venueSubmissions.status, normalized));

    const rows = await filteredQuery.orderBy(desc(venueSubmissions.createdAt));

    return rows.map((row) => this.mapAdminSubmissionRow(row));
  }

  private async findSubmissionById(
    submissionId: number
  ): Promise<typeof venueSubmissions.$inferSelect | null> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const [row] = await this.db
      .select()
      .from(venueSubmissions)
      .where(eq(venueSubmissions.id, submissionId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Atomically approves a pending venue/kiosk submission:
   * 1. Updates matches (admissionFee, matchNotes) if present
   * 2. Updates venues (kioskDescription, parkingNotes) if present
   * 3. Sets venue_submissions.status = 'approved'
   * 4. Sends Telegram confirmation message
   */
  async approveSubmission(submissionId: number): Promise<VenueSubmission> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const submission = await this.findSubmissionById(submissionId);

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    const runUpdates = async (tx: DrizzleDb): Promise<VenueSubmission> => {
      const now = new Date();
      const data = submission.submittedData ?? {};

      const admissionFee = data.admissionFee ?? undefined;
      const matchNotes = data.matchNotes ?? data.notes ?? undefined;

      if (
        submission.matchId &&
        ((admissionFee !== undefined && admissionFee !== null) ||
          (matchNotes !== undefined && matchNotes !== null))
      ) {
        const matchUpdates: MatchModerationPatch = { updatedAt: now };

        if (admissionFee !== undefined && admissionFee !== null) {
          matchUpdates.admissionFee = admissionFee;
        }

        if (matchNotes !== undefined && matchNotes !== null) {
          matchUpdates.matchNotes = matchNotes;
        }

        await tx
          .update(matches)
          .set(matchUpdates)
          .where(eq(matches.id, submission.matchId));
      }

      const kioskDescription = data.kioskDescription ?? data.kiosk ?? undefined;
      const parkingNotes = data.parkingNotes ?? data.parking ?? undefined;

      if (
        submission.venueId &&
        ((kioskDescription !== undefined && kioskDescription !== null) ||
          (parkingNotes !== undefined && parkingNotes !== null))
      ) {
        const venueUpdates: VenueModerationPatch = { updatedAt: now };

        if (kioskDescription !== undefined && kioskDescription !== null) {
          venueUpdates.kioskDescription = kioskDescription;
        }

        if (parkingNotes !== undefined && parkingNotes !== null) {
          venueUpdates.parkingNotes = parkingNotes;
        }

        await tx
          .update(venues)
          .set(venueUpdates)
          .where(eq(venues.id, submission.venueId));
      }

      const [updated] = await tx
        .update(venueSubmissions)
        .set({
          status: 'approved',
          updatedAt: now,
        })
        .where(eq(venueSubmissions.id, submissionId))
        .returning();

      return (
        updated ?? {
          ...submission,
          status: 'approved',
          updatedAt: now,
        }
      );
    };

    const updatedSubmission = this.db.transaction
      ? await this.db.transaction((tx) => runUpdates(tx))
      : await runUpdates(this.db);

    if (this.telegramNotifier) {
      await this.telegramNotifier.sendSubmissionApprovedConfirmation(submissionId);
    }

    return updatedSubmission;
  }

  /**
   * Rejects a venue/kiosk submission without modifying match or venue records.
   */
  async rejectSubmission(submissionId: number): Promise<VenueSubmission> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const submission = await this.findSubmissionById(submissionId);

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    const now = new Date();

    const [updated] = await this.db
      .update(venueSubmissions)
      .set({
        status: 'rejected',
        updatedAt: now,
      })
      .where(eq(venueSubmissions.id, submissionId))
      .returning();

    return (
      updated ?? {
        ...submission,
        status: 'rejected',
        updatedAt: now,
      }
    );
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
      matchNotes: row.match.matchNotes ?? undefined,
      isFeatured: Boolean(row.match.isFeatured),
      featuredUntil: featuredUntilIso,
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
   * Lists all currently active Featured Matches (`is_featured = true` and not yet expired).
   */
  async getFeaturedMatches(): Promise<Match[]> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const now = new Date();
    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

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
      .where(
        and(
          eq(matches.isFeatured, true),
          or(isNull(matches.featuredUntil), gte(matches.featuredUntil, now))
        )
      )
      .orderBy(asc(matches.kickoffDate), asc(matches.kickoffTime));

    return rows.map((row) => this.mapAdminMatchRow(row));
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

    const [updated] = await this.db
      .update(matches)
      .set({
        isFeatured: dto.isFeatured,
        featuredUntil,
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
      matchNotes: updated.matchNotes ?? undefined,
      isFeatured: Boolean(updated.isFeatured),
      featuredUntil:
        updated.featuredUntil instanceof Date
          ? updated.featuredUntil.toISOString()
          : (updated.featuredUntil ?? null),
    };
  }

  async toggleMatchFeature(matchId: number, dto: FeatureMatchDto): Promise<Match> {
    return this.featureMatch(matchId, dto);
  }
}
