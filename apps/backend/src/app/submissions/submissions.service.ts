import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { aliasedTable, and, desc, eq } from 'drizzle-orm';
import type {
  CreateKioskSubmissionDto,
  UpdateSubmissionDto,
  VenueSubmission,
  VenueSubmissionData,
  VenueSubmissionScope,
  VenueSubmissionStatus,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  leagues,
  matches,
  teams,
  venues,
  venueSubmissions,
} from '../database/schema';
import { TelegramNotifierService } from '../scraper/telegram-notifier.service';

export interface ValidatedKioskSubmission {
  matchId?: number;
  admissionFee: string;
  kioskDescription: string;
  parkingNotes: string;
  matchNotes: string;
  submitterName: string;
  submitterRole: string;
  scope: VenueSubmissionScope;
}

export function validateKioskSubmissionDto(
  dto?: CreateKioskSubmissionDto | null
): ValidatedKioskSubmission {
  const admissionFee = dto?.admissionFee ? String(dto.admissionFee).trim() : '';
  const kioskDescription = dto?.kioskDescription ? String(dto.kioskDescription).trim() : '';
  const parkingNotes = dto?.parkingNotes ? String(dto.parkingNotes).trim() : '';
  const matchNotes = dto?.matchNotes ? String(dto.matchNotes).trim() : '';
  const submitterName = dto?.submitterName ? String(dto.submitterName).trim() : '';
  const submitterRole = dto?.submitterRole ? String(dto.submitterRole).trim() : '';

  let scope: VenueSubmissionScope = 'matchday';

  if (dto?.scope !== undefined) {
    if (dto.scope === 'match' || dto.scope === 'matchday') {
      scope = dto.scope;
    } else {
      throw new BadRequestException('scope must be either "match" or "matchday"');
    }
  }

  if (admissionFee.length > 50) {
    throw new BadRequestException('admissionFee must not exceed 50 characters');
  }

  if (kioskDescription.length > 200) {
    throw new BadRequestException('kioskDescription must not exceed 200 characters');
  }

  if (parkingNotes.length > 200) {
    throw new BadRequestException('parkingNotes must not exceed 200 characters');
  }

  if (matchNotes.length > 200) {
    throw new BadRequestException('matchNotes must not exceed 200 characters');
  }

  if (submitterName.length > 50) {
    throw new BadRequestException('submitterName must not exceed 50 characters');
  }

  if (submitterRole.length > 50) {
    throw new BadRequestException('submitterRole must not exceed 50 characters');
  }

  const hasContent = Boolean(
    admissionFee || kioskDescription || parkingNotes || matchNotes
  );

  if (!hasContent) {
    throw new BadRequestException(
      'At least one content field (admissionFee, kioskDescription, parkingNotes, or matchNotes) must be provided'
    );
  }

  return {
    matchId: dto?.matchId,
    admissionFee,
    kioskDescription,
    parkingNotes,
    matchNotes,
    submitterName,
    submitterRole,
    scope,
  };
}

export interface AdminRelationalSubmissionRow {
  submission: typeof venueSubmissions.$inferSelect;
  match?: typeof matches.$inferSelect | null;
  league?: typeof leagues.$inferSelect | null;
  homeTeam?: typeof teams.$inferSelect | null;
  guestTeam?: typeof teams.$inferSelect | null;
  venue?: typeof venues.$inferSelect | null;
}

export type MatchModerationPatch = Partial<
  Pick<
    typeof matches.$inferInsert,
    | 'admissionFee'
    | 'kioskDescription'
    | 'parkingNotes'
    | 'matchNotes'
    | 'submitterName'
    | 'submitterRole'
    | 'updatedAt'
  >
>;

export type VenueModerationPatch = Partial<
  Pick<
    typeof venues.$inferInsert,
    'kioskDescription' | 'parkingNotes' | 'updatedAt'
  >
>;

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
export class SubmissionsService {
  constructor(
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    @Optional() private readonly telegramNotifier?: TelegramNotifierService
  ) {}

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
      scope: sub.scope,
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
   * Validates and creates a crowd-sourced kiosk/venue submission in venue_submissions with status 'pending',
   * and dispatches a real-time Telegram alert to the admin.
   */
  async createSubmission(
    dto: CreateKioskSubmissionDto
  ): Promise<VenueSubmission> {
    const validated = validateKioskSubmissionDto(dto);

    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    if (!dto.matchId || !Number.isInteger(dto.matchId) || dto.matchId <= 0) {
      throw new BadRequestException('Valid matchId is required');
    }

    const matchId = dto.matchId;
    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    const [matchRow] = await this.db
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

    if (!matchRow) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    const submittedData: VenueSubmissionData = {
      admissionFee: validated.admissionFee || null,
      kioskDescription: validated.kioskDescription || null,
      parkingNotes: validated.parkingNotes || null,
      matchNotes: validated.matchNotes || null,
    };

    const now = new Date();

    const [inserted] = await this.db
      .insert(venueSubmissions)
      .values({
        matchId: matchRow.match.id,
        venueId: matchRow.venue?.id ?? null,
        submitterName: validated.submitterName || null,
        submitterRole: validated.submitterRole || null,
        submittedData,
        scope: validated.scope,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (this.telegramNotifier) {
      await this.telegramNotifier.sendKioskSubmissionAlert({
        submissionId: inserted.id,
        homeTeam: matchRow.homeTeam.name,
        guestTeam: matchRow.guestTeam.name,
        leagueName: matchRow.league?.name ?? `Liga #${matchRow.match.leagueId}`,
        venueName: matchRow.venue?.name ?? null,
        city: matchRow.venue?.city ?? null,
        admissionFee: submittedData.admissionFee,
        kioskDescription: submittedData.kioskDescription,
        parkingNotes: submittedData.parkingNotes,
        matchNotes: submittedData.matchNotes,
        submitterName: inserted.submitterName,
        submitterRole: inserted.submitterRole,
      });
    }

    return this.mapAdminSubmissionRow({
      submission: inserted,
      match: matchRow.match,
      league: matchRow.league,
      homeTeam: matchRow.homeTeam,
      guestTeam: matchRow.guestTeam,
      venue: matchRow.venue,
    });
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

  /**
   * Retrieves single submission by ID with complete relational match and venue metadata.
   */
  async getSubmissionById(id: number): Promise<VenueSubmission> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const homeTeam = aliasedTable(teams, 'home_team');
    const guestTeam = aliasedTable(teams, 'guest_team');

    const [row] = await this.db
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
      .leftJoin(venues, eq(venueSubmissions.venueId, venues.id))
      .where(eq(venueSubmissions.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    return this.mapAdminSubmissionRow(row);
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
      const kioskDescription = data.kioskDescription ?? data.kiosk ?? undefined;
      const parkingNotes = data.parkingNotes ?? data.parking ?? undefined;
      const submitterName = submission.submitterName ?? undefined;
      const submitterRole = submission.submitterRole ?? undefined;
      const scope: VenueSubmissionScope = submission.scope ?? 'matchday';

      if (scope === 'match') {
        // Scope "match": Update only the specific match
        if (submission.matchId) {
          const matchUpdates: MatchModerationPatch = { updatedAt: now };

          if (admissionFee !== undefined && admissionFee !== null) {
            matchUpdates.admissionFee = admissionFee;
          }

          if (matchNotes !== undefined && matchNotes !== null) {
            matchUpdates.matchNotes = matchNotes;
          }

          if (kioskDescription !== undefined && kioskDescription !== null) {
            matchUpdates.kioskDescription = kioskDescription;
          }

          if (parkingNotes !== undefined && parkingNotes !== null) {
            matchUpdates.parkingNotes = parkingNotes;
          }

          if (submitterName !== undefined && submitterName !== null) {
            matchUpdates.submitterName = submitterName;
          }

          if (submitterRole !== undefined && submitterRole !== null) {
            matchUpdates.submitterRole = submitterRole;
          }

          await tx
            .update(matches)
            .set(matchUpdates)
            .where(eq(matches.id, submission.matchId));
        }
      } else {
        // Scope "matchday":
        // 1. Admission fee, match notes and submitter attribution are always match-specific
        if (
          submission.matchId &&
          ((admissionFee !== undefined && admissionFee !== null) ||
            (matchNotes !== undefined && matchNotes !== null) ||
            (submitterName !== undefined && submitterName !== null) ||
            (submitterRole !== undefined && submitterRole !== null))
        ) {
          const matchUpdates: MatchModerationPatch = { updatedAt: now };

          if (admissionFee !== undefined && admissionFee !== null) {
            matchUpdates.admissionFee = admissionFee;
          }

          if (matchNotes !== undefined && matchNotes !== null) {
            matchUpdates.matchNotes = matchNotes;
          }

          if (submitterName !== undefined && submitterName !== null) {
            matchUpdates.submitterName = submitterName;
          }

          if (submitterRole !== undefined && submitterRole !== null) {
            matchUpdates.submitterRole = submitterRole;
          }

          await tx
            .update(matches)
            .set(matchUpdates)
            .where(eq(matches.id, submission.matchId));
        }

        // 2. Kiosk and parking updates for all matches on the same kickoff date in this venue
        if (
          (kioskDescription !== undefined && kioskDescription !== null) ||
          (parkingNotes !== undefined && parkingNotes !== null)
        ) {
          let targetKickoffDate: string | null = null;
          let targetVenueId: number | null = submission.venueId ?? null;

          if (submission.matchId) {
            const [matchRow] = await tx
              .select({
                kickoffDate: matches.kickoffDate,
                venueId: matches.venueId,
              })
              .from(matches)
              .where(eq(matches.id, submission.matchId))
              .limit(1);

            if (matchRow) {
              targetKickoffDate = matchRow.kickoffDate ?? null;

              if (matchRow.venueId) {
                targetVenueId = matchRow.venueId;
              }
            }
          }

          if (targetVenueId && targetKickoffDate) {
            const matchdayUpdates: MatchModerationPatch = { updatedAt: now };

            if (kioskDescription !== undefined && kioskDescription !== null) {
              matchdayUpdates.kioskDescription = kioskDescription;
            }

            if (parkingNotes !== undefined && parkingNotes !== null) {
              matchdayUpdates.parkingNotes = parkingNotes;
            }

            await tx
              .update(matches)
              .set(matchdayUpdates)
              .where(
                and(
                  eq(matches.venueId, targetVenueId),
                  eq(matches.kickoffDate, targetKickoffDate)
                )
              );
          }

          // Also update the venue default record
          if (targetVenueId) {
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
              .where(eq(venues.id, targetVenueId));
          }
        }
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

  private normalizeNullableText(val: string | null | undefined): string | null {
    if (val === null || val === undefined) {
      return null;
    }

    const trimmed = String(val).trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Updates the submitted fields, submitter metadata, and optional status of a submission.
   * When the submission has or receives `status === 'approved'`, the updated fields are
   * also synchronized into the linked `matches` and `venues` records.
   */
  async updateSubmission(
    submissionId: number,
    dto: UpdateSubmissionDto
  ): Promise<VenueSubmission> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const submission = await this.findSubmissionById(submissionId);

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    if (
      dto.status !== undefined &&
      dto.status !== 'pending' &&
      dto.status !== 'approved' &&
      dto.status !== 'rejected'
    ) {
      throw new BadRequestException(
        `Invalid status "${dto.status}". Allowed values: pending, approved, rejected`
      );
    }

    if (
      dto.scope !== undefined &&
      dto.scope !== 'match' &&
      dto.scope !== 'matchday'
    ) {
      throw new BadRequestException(
        `Invalid scope "${dto.scope}". Allowed values: match, matchday`
      );
    }

    const nextScope: VenueSubmissionScope = dto.scope ?? submission.scope ?? 'matchday';
    const nextStatus: VenueSubmissionStatus = dto.status ?? submission.status;

    const nextSubmittedData: VenueSubmissionData = {
      ...submission.submittedData,
    };

    if (dto.admissionFee !== undefined) {
      nextSubmittedData.admissionFee = this.normalizeNullableText(dto.admissionFee);
    }

    if (dto.kioskDescription !== undefined) {
      nextSubmittedData.kioskDescription = this.normalizeNullableText(
        dto.kioskDescription
      );
      delete nextSubmittedData.kiosk;
    }

    if (dto.parkingNotes !== undefined) {
      nextSubmittedData.parkingNotes = this.normalizeNullableText(dto.parkingNotes);
      delete nextSubmittedData.parking;
    }

    if (dto.matchNotes !== undefined) {
      nextSubmittedData.matchNotes = this.normalizeNullableText(dto.matchNotes);
      delete nextSubmittedData.notes;
    }

    const nextSubmitterName =
      dto.submitterName !== undefined
        ? this.normalizeNullableText(dto.submitterName)
        : (submission.submitterName ?? null);

    const nextSubmitterRole =
      dto.submitterRole !== undefined
        ? this.normalizeNullableText(dto.submitterRole)
        : (submission.submitterRole ?? null);

    const runUpdates = async (tx: DrizzleDb): Promise<VenueSubmission> => {
      const now = new Date();

      if (nextStatus === 'approved') {
        const kioskDescription =
          nextSubmittedData.kioskDescription !== undefined
            ? nextSubmittedData.kioskDescription
            : (nextSubmittedData.kiosk ?? undefined);

        const parkingNotes =
          nextSubmittedData.parkingNotes !== undefined
            ? nextSubmittedData.parkingNotes
            : (nextSubmittedData.parking ?? undefined);

        const admissionFee =
          nextSubmittedData.admissionFee !== undefined
            ? nextSubmittedData.admissionFee
            : undefined;

        const matchNotes =
          nextSubmittedData.matchNotes !== undefined
            ? nextSubmittedData.matchNotes
            : (nextSubmittedData.notes ?? undefined);

        const submitterName =
          nextSubmitterName !== undefined && nextSubmitterName !== null
            ? nextSubmitterName
            : undefined;

        const submitterRole =
          nextSubmitterRole !== undefined && nextSubmitterRole !== null
            ? nextSubmitterRole
            : undefined;

        if (nextScope === 'match') {
          if (submission.matchId) {
            const matchUpdates: MatchModerationPatch = { updatedAt: now };

            if (admissionFee !== undefined && admissionFee !== null) {
              matchUpdates.admissionFee = admissionFee;
            }

            if (matchNotes !== undefined && matchNotes !== null) {
              matchUpdates.matchNotes = matchNotes;
            }

            if (kioskDescription !== undefined && kioskDescription !== null) {
              matchUpdates.kioskDescription = kioskDescription;
            }

            if (parkingNotes !== undefined && parkingNotes !== null) {
              matchUpdates.parkingNotes = parkingNotes;
            }

            if (submitterName !== undefined && submitterName !== null) {
              matchUpdates.submitterName = submitterName;
            }

            if (submitterRole !== undefined && submitterRole !== null) {
              matchUpdates.submitterRole = submitterRole;
            }

            await tx
              .update(matches)
              .set(matchUpdates)
              .where(eq(matches.id, submission.matchId));
          }
        } else {
          // Scope "matchday":
          // 1. Match-specific updates
          if (
            submission.matchId &&
            ((admissionFee !== undefined && admissionFee !== null) ||
              (matchNotes !== undefined && matchNotes !== null) ||
              (submitterName !== undefined && submitterName !== null) ||
              (submitterRole !== undefined && submitterRole !== null))
          ) {
            const matchUpdates: MatchModerationPatch = { updatedAt: now };

            if (admissionFee !== undefined && admissionFee !== null) {
              matchUpdates.admissionFee = admissionFee;
            }

            if (matchNotes !== undefined && matchNotes !== null) {
              matchUpdates.matchNotes = matchNotes;
            }

            if (submitterName !== undefined && submitterName !== null) {
              matchUpdates.submitterName = submitterName;
            }

            if (submitterRole !== undefined && submitterRole !== null) {
              matchUpdates.submitterRole = submitterRole;
            }

            await tx
              .update(matches)
              .set(matchUpdates)
              .where(eq(matches.id, submission.matchId));
          }

          // 2. Kiosk and parking updates across matchday & venue
          if (
            (kioskDescription !== undefined && kioskDescription !== null) ||
            (parkingNotes !== undefined && parkingNotes !== null)
          ) {
            let targetKickoffDate: string | null = null;
            let targetVenueId: number | null = submission.venueId ?? null;

            if (submission.matchId) {
              const [matchRow] = await tx
                .select({
                  kickoffDate: matches.kickoffDate,
                  venueId: matches.venueId,
                })
                .from(matches)
                .where(eq(matches.id, submission.matchId))
                .limit(1);

              if (matchRow) {
                targetKickoffDate = matchRow.kickoffDate ?? null;

                if (matchRow.venueId) {
                  targetVenueId = matchRow.venueId;
                }
              }
            }

            if (targetVenueId && targetKickoffDate) {
              const matchdayUpdates: MatchModerationPatch = { updatedAt: now };

              if (kioskDescription !== undefined && kioskDescription !== null) {
                matchdayUpdates.kioskDescription = kioskDescription;
              }

              if (parkingNotes !== undefined && parkingNotes !== null) {
                matchdayUpdates.parkingNotes = parkingNotes;
              }

              await tx
                .update(matches)
                .set(matchdayUpdates)
                .where(
                  and(
                    eq(matches.venueId, targetVenueId),
                    eq(matches.kickoffDate, targetKickoffDate)
                  )
                );
            }

            if (targetVenueId) {
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
                .where(eq(venues.id, targetVenueId));
            }
          }
        }
      }

      const [updated] = await tx
        .update(venueSubmissions)
        .set({
          submitterName: nextSubmitterName,
          submitterRole: nextSubmitterRole,
          submittedData: nextSubmittedData,
          scope: nextScope,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(venueSubmissions.id, submissionId))
        .returning();

      return (
        updated ?? {
          ...submission,
          submitterName: nextSubmitterName,
          submitterRole: nextSubmitterRole,
          submittedData: nextSubmittedData,
          scope: nextScope,
          status: nextStatus,
          updatedAt: now,
        }
      );
    };

    const updatedSubmission = this.db.transaction
      ? await this.db.transaction((tx) => runUpdates(tx))
      : await runUpdates(this.db);

    if (
      submission.status !== 'approved' &&
      nextStatus === 'approved' &&
      this.telegramNotifier
    ) {
      await this.telegramNotifier.sendSubmissionApprovedConfirmation(submissionId);
    }

    return updatedSubmission;
  }

  /**
   * Deletes a submission from `venue_submissions`.
   */
  async deleteSubmission(
    submissionId: number
  ): Promise<{ id: number; deleted: boolean }> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const submission = await this.findSubmissionById(submissionId);

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    await this.db
      .delete(venueSubmissions)
      .where(eq(venueSubmissions.id, submissionId));

    return { id: submissionId, deleted: true };
  }
}
