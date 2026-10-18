import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

@Injectable()
export class ScraperSchedulerService {
  private readonly logger = new Logger(ScraperSchedulerService.name);
  private isSyncRunning = false;

  constructor(private readonly scraperService: ScraperService) {}

  /**
   * Weekly Full Sync: Discovers all leagues and updates full schedules across Baden-Württemberg.
   * Runs every Tuesday at 03:00 AM (safe off-peak window when league schedules and gym allocations settle).
   */
  @Cron('0 3 * * 2', { name: 'weekly-bawue-full-sync' })
  async handleWeeklyFullSync(): Promise<void> {
    if (process.env['DISABLE_CRON'] === 'true') {
      this.logger.log('Weekly full sync skipped (DISABLE_CRON is set).');

      return;
    }

    if (this.isSyncRunning) {
      this.logger.warn('Weekly full sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled weekly full sync for Baden-Württemberg leagues...');
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.syncAllBawueLeagues({ quickSync: false });

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
   * Weekend Match Sync: Frequent sync on game days (Saturdays and Sundays) to update match scores and status.
   * Runs every 2 hours between 12:00 and 22:00 on Saturdays and Sundays.
   */
  @Cron('0 12-22/2 * * 0,6', { name: 'weekend-bawue-match-sync' })
  async handleWeekendMatchSync(): Promise<void> {
    if (process.env['DISABLE_CRON'] === 'true') {
      this.logger.log('Weekend match sync skipped (DISABLE_CRON is set).');

      return;
    }

    if (this.isSyncRunning) {
      this.logger.warn('Weekend match sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled weekend match sync for Baden-Württemberg leagues...');
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.syncAllBawueLeagues({ quickSync: true });

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
