import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { systemSettings } from '../database/schema';

export interface TelegramSyncSummary {
  status: 'success' | 'partial' | 'error';
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  syncedMatches: number;
  failuresCount: number;
  failedLeagues?: string[];
  errorMessage?: string | null;
}

export interface TelegramPayload {
  chat_id: string | null;
  text: string;
  message_id?: number;
  parse_mode?: string;
  disable_web_page_preview?: boolean;
}

export function formatGermanDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${formatter.format(date)} Uhr`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

@Injectable()
export class TelegramNotifierService {
  private readonly logger = new Logger(TelegramNotifierService.name);
  private readonly botToken: string | null;
  private readonly chatId: string | null;
  private readonly adminBaseUrl: string;

  constructor(
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null
  ) {
    this.botToken = process.env['TELEGRAM_BOT_TOKEN'] || null;
    this.chatId = process.env['TELEGRAM_CHAT_ID'] || null;

    const rawAdminUrl =
      process.env['ADMIN_BASE_URL'] || 'http://raspberrypi.local:3000';

    this.adminBaseUrl = rawAdminUrl.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  private async getSetting(key: string): Promise<string | null> {
    if (!this.db) {
      return null;
    }

    try {
      const [setting] = await this.db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      return setting?.value ?? null;
    } catch (err) {
      this.logger.debug(`Could not read ${key} from system_settings:`, err);

      return null;
    }
  }

  private async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const now = new Date();

      await this.db
        .insert(systemSettings)
        .values({
          key,
          value,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value,
            updatedAt: now,
          },
        });
    } catch (err) {
      this.logger.warn(`Could not set ${key} in system_settings:`, err);
    }
  }

  private async callTelegramApi(
    method: 'sendMessage' | 'editMessageText',
    payload: TelegramPayload
  ): Promise<{ ok: boolean; result?: { message_id: number }; description?: string }> {
    if (!this.botToken) {
      return { ok: false, description: 'Telegram bot token is not configured' };
    }

    const url = `https://api.telegram.org/bot${this.botToken}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // SAFETY: Telegram Bot API returns JSON with ok boolean and optional result/description
      const data = (await response.json()) as {
        ok: boolean;
        result?: { message_id: number };
        description?: string;
      };

      return data;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Telegram API call ${method} failed: ${errMsg}`);

      return { ok: false, description: errMsg };
    }
  }

  /**
   * Updates the pinned/live status message on sync completion and fires transition alerts.
   */
  async updateLiveStatus(summary: TelegramSyncSummary): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.debug('Telegram alerting skipped (bot token or chat ID not configured).');

      return;
    }

    const formattedDate = formatGermanDate(summary.finishedAt);
    const formattedDuration = formatDuration(summary.durationMs);
    const adminDashboardUrl = `${this.adminBaseUrl}/admin`;

    const isHealthy = summary.status === 'success' && summary.failuresCount === 0;

    let liveText = '';

    if (isHealthy) {
      liveText =
        `🟢 *HeimspielRadar: Alles OK*\n` +
        `Letzter Sync: ${formattedDate}\n` +
        `Dauer: ${formattedDuration} • Spiele: ${summary.syncedMatches} • Fehler: 0`;
    } else {
      let failureDetail = '';

      if (summary.failedLeagues && summary.failedLeagues.length > 0) {
        failureDetail = `Fehler bei ${summary.failedLeagues.length} Ligen: ${summary.failedLeagues.slice(0, 3).join(', ')}`;
      } else if (summary.errorMessage) {
        failureDetail = `Fehler: ${summary.errorMessage}`;
      } else {
        failureDetail = `Fehler bei ${summary.failuresCount} Elementen`;
      }

      liveText =
        `🔴 *HeimspielRadar: FEHLER beim Sync*\n` +
        `Letzter Sync: ${formattedDate}\n` +
        `${failureDetail}\n` +
        `👉 [Admin Dashboard öffnen](${adminDashboardUrl})`;
    }

    // 1. Update or create the live status message
    const savedMessageIdStr = await this.getSetting('telegram_status_message_id');
    let messageUpdated = false;

    if (savedMessageIdStr) {
      const messageId = parseInt(savedMessageIdStr, 10);

      if (!isNaN(messageId)) {
        const editRes = await this.callTelegramApi('editMessageText', {
          chat_id: this.chatId,
          message_id: messageId,
          text: liveText,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });

        if (editRes.ok) {
          messageUpdated = true;
        } else {
          this.logger.debug(`Could not edit message ${messageId}: ${editRes.description}. Sending new message.`);
        }
      }
    }

    if (!messageUpdated) {
      const sendRes = await this.callTelegramApi('sendMessage', {
        chat_id: this.chatId,
        text: liveText,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      if (sendRes.ok && sendRes.result?.message_id) {
        await this.setSetting('telegram_status_message_id', sendRes.result.message_id.toString());
      }
    }

    // 2. Health transition push alerts
    const previousHealthStatus = await this.getSetting('telegram_last_health_status');
    const currentHealthStatus = isHealthy ? 'healthy' : 'failing';

    if (previousHealthStatus === 'healthy' && currentHealthStatus === 'failing') {
      let alertDetail = summary.errorMessage || 'Sync-Fehler festgestellt';

      if (summary.failedLeagues && summary.failedLeagues.length > 0) {
        alertDetail = `Fehler bei ${summary.failedLeagues.length} Ligen: ${summary.failedLeagues.slice(0, 3).join(', ')}`;
      }

      const pushAlert =
        `🔴 *HeimspielRadar Alert: Sync-Fehler*\n` +
        `Letzter Sync: ${formattedDate}\n` +
        `${alertDetail}\n` +
        `👉 [Admin Dashboard öffnen](${adminDashboardUrl})`;

      await this.callTelegramApi('sendMessage', {
        chat_id: this.chatId,
        text: pushAlert,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      await this.setSetting('telegram_last_health_status', 'failing');
    } else if (previousHealthStatus === 'failing' && currentHealthStatus === 'healthy') {
      const recoveryAlert =
        `🟢 *HeimspielRadar Entwarnung: Alles wieder OK*\n` +
        `Letzter Sync: ${formattedDate}\n` +
        `Alle Ligen wurden erfolgreich synchronisiert.\n` +
        `👉 [Admin Dashboard öffnen](${adminDashboardUrl})`;

      await this.callTelegramApi('sendMessage', {
        chat_id: this.chatId,
        text: recoveryAlert,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });

      await this.setSetting('telegram_last_health_status', 'healthy');
    } else if (!previousHealthStatus) {
      await this.setSetting('telegram_last_health_status', currentHealthStatus);
    }
  }

  /**
   * Sends an immediate test verification message.
   */
  async sendTestMessage(): Promise<{ success: boolean; message?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Telegram bot token or chat ID is not configured',
      };
    }

    const testText =
      `🔔 *HeimspielRadar Testnachricht*\n` +
      `Die Verbindung zum Telegram Bot funktioniert einwandfrei!\n` +
      `Zeitpunkt: ${formatGermanDate(new Date())}`;

    const res = await this.callTelegramApi('sendMessage', {
      chat_id: this.chatId,
      text: testText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    if (res.ok) {
      return {
        success: true,
        message: 'Test message sent successfully via Telegram bot',
      };
    }

    return {
      success: false,
      message: res.description || 'Unknown error sending Telegram test message',
    };
  }
}
