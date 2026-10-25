import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

const CRON_DEEP_SCHEDULE = process.env['CRON_DEEP_SCHEDULE'] || '0 2 * * 2';
const CRON_DELTA_SCHEDULE = process.env['CRON_DELTA_SCHEDULE'] || '0 5,18 * * *';

@Injectable()
export class ScraperSchedulerService {
  private readonly logger = new Logger(ScraperSchedulerService.name);
  private isSyncRunning = false;

  constructor(private readonly scraperService: ScraperService) {}

  private isCronDisabled(): boolean {
    if (process.env['DISABLE_CRON'] === 'true') {
      return true;
    }

    if (process.env['ENABLE_CRON_SYNC'] === 'false') {
      return true;
    }

    return false;
  }

  /**
   * Weekly Full Sync: Discovers all leagues and updates full schedules across Baden-Württemberg.
   * Default: Runs every Tuesday at 02:00 AM (configurable via CRON_DEEP_SCHEDULE).
   */
  @Cron(CRON_DEEP_SCHEDULE, { name: 'weekly-bawue-full-sync' })
  async handleWeeklyFullSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Weekly full sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning || this.scraperService.isSyncActive()) {
      this.logger.warn('Weekly full sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled weekly full sync for Baden-Württemberg leagues...');
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.executeAuditedSync({
        type: 'deep',
        target: 'verband:1',
      });

      this.logger.log(
        `Scheduled weekly full sync completed in ${result.durationMs}ms: ` +
          `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
          `${result.syncedMatches} matches synced, ${result.geocodedVenues} venues geocoded.`
      );
    } catch (error) {
      this.logger.error('Scheduled weekly full sync failed:', error);
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Weekend / Delta Match Sync: Frequent sync to update match scores and status.
   * Default: Runs at 05:00 and 18:00 daily (configurable via CRON_DELTA_SCHEDULE).
   */
  @Cron(CRON_DELTA_SCHEDULE, { name: 'weekend-bawue-match-sync' })
  async handleWeekendMatchSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Weekend match sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning || this.scraperService.isSyncActive()) {
      this.logger.warn('Weekend match sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled weekend match sync for Baden-Württemberg leagues...');
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.executeAuditedSync({
        type: 'delta',
        target: 'verband:1',
      });

      this.logger.log(
        `Scheduled weekend match sync completed in ${result.durationMs}ms: ` +
          `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
          `${result.syncedMatches} matches updated.`
      );
    } catch (error) {
      this.logger.error('Scheduled weekend match sync failed:', error);
    } finally {
      this.isSyncRunning = false;
    }
  }
}
