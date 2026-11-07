import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import {
  matches,
  pushReminders,
  systemSettings,
} from '../database/schema';
import type { RegisterPushReminderDto } from './dto/register-push-reminder.dto';
import {
  generateVapidKeys,
  isReminderDue,
  sendWebPushNotification,
} from './web-push.util';

export interface MatchUpdateSnapshot {
  matchId: number;
  kickoffDate?: string | null;
  kickoffTime?: string | null;
  venueId?: number | null;
}

export interface VapidPublicKeyResponse {
  publicKey: string;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private vapidPublicKey = '';
  private vapidPrivateKey = '';
  private vapidSubject = 'mailto:info@heimspielradar.de';

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initVapidKeys();
  }

  /**
   * 3-tier fallback for VAPID keys:
   * 1. Environment variables
   * 2. system_settings DB table
   * 3. Dynamically generated & persisted to system_settings
   */
  async initVapidKeys(): Promise<void> {
    this.vapidSubject =
      this.configService.get<string>('VAPID_SUBJECT') ||
      process.env['VAPID_SUBJECT'] ||
      'mailto:info@heimspielradar.de';

    const envPublic =
      this.configService.get<string>('VAPID_PUBLIC_KEY') ||
      process.env['VAPID_PUBLIC_KEY'];

    const envPrivate =
      this.configService.get<string>('VAPID_PRIVATE_KEY') ||
      process.env['VAPID_PRIVATE_KEY'];

    if (envPublic && envPrivate) {
      this.vapidPublicKey = envPublic.trim();
      this.vapidPrivateKey = envPrivate.trim();
      this.logger.log('Loaded VAPID keys from environment variables.');

      return;
    }

    if (this.db) {
      try {
        const storedKeys = await this.db
          .select()
          .from(systemSettings)
          .where(
            inArray(systemSettings.key, ['vapid_public_key', 'vapid_private_key']),
          );

        const dbPublic = storedKeys.find((k) => k.key === 'vapid_public_key')?.value;
        const dbPrivate = storedKeys.find((k) => k.key === 'vapid_private_key')?.value;

        if (dbPublic && dbPrivate) {
          this.vapidPublicKey = dbPublic.trim();
          this.vapidPrivateKey = dbPrivate.trim();
          this.logger.log('Loaded VAPID keys from database system_settings.');

          return;
        }

        // Generate new keys and persist to database
        const newKeys = generateVapidKeys();
        const now = new Date();

        await this.db
          .insert(systemSettings)
          .values([
            { key: 'vapid_public_key', value: newKeys.publicKey, updatedAt: now },
            { key: 'vapid_private_key', value: newKeys.privateKey, updatedAt: now },
          ])
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: systemSettings.value,
              updatedAt: now,
            },
          });

        this.vapidPublicKey = newKeys.publicKey;
        this.vapidPrivateKey = newKeys.privateKey;
        this.logger.log('Generated and persisted new VAPID keypair in system_settings.');

        return;
      } catch (err) {
        this.logger.warn('Failed to load or persist VAPID keys from database:', err);
      }
    }

    // Ephemeral fallback if database is unavailable
    const fallbackKeys = generateVapidKeys();
    this.vapidPublicKey = fallbackKeys.publicKey;
    this.vapidPrivateKey = fallbackKeys.privateKey;
    this.logger.warn('Using ephemeral VAPID keys (database unavailable).');
  }

  getVapidPublicKey(): VapidPublicKeyResponse {
    return { publicKey: this.vapidPublicKey };
  }

  getVapidPrivateKey(): string {
    return this.vapidPrivateKey;
  }

  getVapidSubject(): string {
    return this.vapidSubject;
  }

  async registerReminder(dto: RegisterPushReminderDto) {
    const endpoint = dto.subscription?.endpoint || dto.endpoint;
    const p256dh = dto.subscription?.keys?.p256dh || dto.p256dh;
    const auth = dto.subscription?.keys?.auth || dto.auth;

    if (!dto.matchId || !Number.isFinite(Number(dto.matchId))) {
      throw new BadRequestException('A valid matchId is required.');
    }

    if (!dto.leadTime || !['1h', '2h', '1d'].includes(dto.leadTime)) {
      throw new BadRequestException("Invalid leadTime. Expected '1h', '2h', or '1d'.");
    }

    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException(
        'Push subscription details (endpoint, p256dh, auth) are required.',
      );
    }

    if (!this.db) {
      throw new InternalServerErrorException('Database connection is not available.');
    }

    const match = await this.db.query.matches.findFirst({
      where: eq(matches.id, dto.matchId),
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${dto.matchId} not found.`);
    }

    const now = new Date();

    await this.db
      .insert(pushReminders)
      .values({
        endpoint,
        p256dh,
        auth,
        matchId: dto.matchId,
        leadTime: dto.leadTime,
        reminderSentAt: null,
        kickoffDate: match.kickoffDate,
        kickoffTime: match.kickoffTime,
        venueId: match.venueId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pushReminders.endpoint, pushReminders.matchId],
        set: {
          leadTime: dto.leadTime,
          p256dh,
          auth,
          kickoffDate: match.kickoffDate,
          kickoffTime: match.kickoffTime,
          venueId: match.venueId,
          reminderSentAt: null,
          updatedAt: now,
        },
      });

    return {
      success: true,
      matchId: dto.matchId,
      leadTime: dto.leadTime,
    };
  }

  async deleteReminder(matchId: number, endpoint?: string) {
    if (!this.db) {
      return { success: true };
    }

    if (endpoint) {
      await this.db
        .delete(pushReminders)
        .where(
          and(
            eq(pushReminders.matchId, matchId),
            eq(pushReminders.endpoint, endpoint),
          ),
        );
    } else {
      await this.db
        .delete(pushReminders)
        .where(eq(pushReminders.matchId, matchId));
    }

    return { success: true };
  }

  /**
   * Trigger 1: Scheduled Tip-Off Reminders checked every 5 minutes in Europe/Berlin.
   */
  @Cron('*/5 * * * *', { timeZone: 'Europe/Berlin' })
  async checkDueReminders(now: Date = new Date()): Promise<number> {
    if (!this.db || !this.vapidPublicKey || !this.vapidPrivateKey) {
      return 0;
    }

    try {
      const unsentReminders = await this.db
        .select()
        .from(pushReminders)
        .where(isNull(pushReminders.reminderSentAt));

      let sentCount = 0;

      for (const reminder of unsentReminders) {
        const due = isReminderDue(
          reminder.leadTime,
          reminder.kickoffDate,
          reminder.kickoffTime,
          now,
        );

        if (!due) {
          continue;
        }

        const match = await this.db.query.matches.findFirst({
          where: eq(matches.id, reminder.matchId),
          with: {
            homeTeam: true,
            guestTeam: true,
            venue: true,
          },
        });

        if (!match) {
          continue;
        }

        const homeName = match.homeTeam?.name ?? 'Heimteam';
        const guestName = match.guestTeam?.name ?? 'Gastteam';
        const timeStr = reminder.kickoffTime || match.kickoffTime || '15:00';
        const venueName = match.venue?.name;

        let title = `🏀 Anwurf bald: ${homeName} vs. ${guestName}`;

        if (reminder.leadTime === '1h') {
          title = `🏀 In 1 Stunde Anwurf: ${homeName} vs. ${guestName}`;
        } else if (reminder.leadTime === '2h') {
          title = `🏀 In 2 Stunden Anwurf: ${homeName} vs. ${guestName}`;
        } else if (reminder.leadTime === '1d') {
          title = `🏀 Morgen Anwurf: ${homeName} vs. ${guestName}`;
        }

        const body = `Anwurf um ${timeStr} Uhr${venueName ? ` in ${venueName}` : ''}. Jetzt Vorbericht & Anfahrt prüfen!`;

        const sendResult = await sendWebPushNotification({
          subscription: {
            endpoint: reminder.endpoint,
            keys: {
              p256dh: reminder.p256dh,
              auth: reminder.auth,
            },
          },
          payload: {
            title,
            body,
            matchId: reminder.matchId,
            url: `/matches/${reminder.matchId}`,
          },
          vapidPublicKey: this.vapidPublicKey,
          vapidPrivateKey: this.vapidPrivateKey,
          vapidSubject: this.vapidSubject,
        });

        if (sendResult.expired) {
          this.logger.log(
            `Pruning expired push subscription (${sendResult.statusCode}) for match ${reminder.matchId}`,
          );
          await this.db
            .delete(pushReminders)
            .where(eq(pushReminders.id, reminder.id));
        } else if (sendResult.success) {
          await this.db
            .update(pushReminders)
            .set({
              reminderSentAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(pushReminders.id, reminder.id));

          sentCount++;
        } else {
          this.logger.warn(
            `Failed to dispatch push reminder ${reminder.id}: ${sendResult.error}`,
          );
        }
      }

      return sentCount;
    } catch (err) {
      this.logger.error('Error during scheduled push reminder execution:', err);

      return 0;
    }
  }

  /**
   * Trigger 2: Push on Match Rescheduling or Venue Change during DBB Sync.
   */
  async handleMatchesUpdated(updates: MatchUpdateSnapshot[]): Promise<number> {
    if (!this.db || !this.vapidPublicKey || !this.vapidPrivateKey || updates.length === 0) {
      return 0;
    }

    try {
      const matchIds = [...new Set(updates.map((u) => u.matchId))];

      const activeReminders = await this.db
        .select()
        .from(pushReminders)
        .where(inArray(pushReminders.matchId, matchIds));

      if (activeReminders.length === 0) {
        return 0;
      }

      let notifiedCount = 0;

      for (const reminder of activeReminders) {
        const update = updates.find((u) => u.matchId === reminder.matchId);

        if (!update) {
          continue;
        }

        const newDate = update.kickoffDate ?? reminder.kickoffDate;
        const newTime = update.kickoffTime ?? reminder.kickoffTime;
        const newVenueId = update.venueId !== undefined ? update.venueId : reminder.venueId;

        const dateChanged = Boolean(update.kickoffDate && update.kickoffDate !== reminder.kickoffDate);
        const timeChanged = Boolean(update.kickoffTime && update.kickoffTime !== reminder.kickoffTime);

        const venueChanged = Boolean(
          update.venueId !== undefined && update.venueId !== reminder.venueId,
        );

        if (!dateChanged && !timeChanged && !venueChanged) {
          continue;
        }

        const match = await this.db.query.matches.findFirst({
          where: eq(matches.id, reminder.matchId),
          with: {
            homeTeam: true,
            guestTeam: true,
            venue: true,
          },
        });

        if (!match) {
          continue;
        }

        const homeName = match.homeTeam?.name ?? 'Heim';
        const guestName = match.guestTeam?.name ?? 'Gast';
        const title = `⚠️ Spieländerung: ${homeName} vs. ${guestName}`;

        const details: string[] = [];

        if (dateChanged || timeChanged) {
          details.push(`Neuer Termin: ${newDate ?? ''} um ${newTime ?? ''} Uhr`);
        }

        if (venueChanged) {
          details.push(`Neue Halle: ${match.venue?.name ?? 'Verlegt'}`);
        }

        const body = `${details.join(' • ')}. Tippe für aktuelle Details.`;

        const sendResult = await sendWebPushNotification({
          subscription: {
            endpoint: reminder.endpoint,
            keys: {
              p256dh: reminder.p256dh,
              auth: reminder.auth,
            },
          },
          payload: {
            title,
            body,
            matchId: reminder.matchId,
            url: `/matches/${reminder.matchId}`,
          },
          vapidPublicKey: this.vapidPublicKey,
          vapidPrivateKey: this.vapidPrivateKey,
          vapidSubject: this.vapidSubject,
        });

        if (sendResult.expired) {
          await this.db
            .delete(pushReminders)
            .where(eq(pushReminders.id, reminder.id));
        } else {
          // If postponed and new trigger time is in the future again, reset reminderSentAt
          const isDueNow = isReminderDue(reminder.leadTime, newDate, newTime, new Date());
          const resetReminder = !isDueNow;

          await this.db
            .update(pushReminders)
            .set({
              kickoffDate: newDate,
              kickoffTime: newTime,
              venueId: newVenueId,
              reminderSentAt: resetReminder ? null : reminder.reminderSentAt,
              updatedAt: new Date(),
            })
            .where(eq(pushReminders.id, reminder.id));

          notifiedCount++;
        }
      }

      return notifiedCount;
    } catch (err) {
      this.logger.error('Error handling match updates for push reminders:', err);

      return 0;
    }
  }
}
