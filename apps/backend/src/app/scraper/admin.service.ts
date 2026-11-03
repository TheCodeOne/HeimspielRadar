import {
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { VenueSubmission } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { matches, venues, venueSubmissions } from '../database/schema';
import { TelegramNotifierService } from './telegram-notifier.service';

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
    if (process.env['NODE_ENV'] === 'production') {
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
}
