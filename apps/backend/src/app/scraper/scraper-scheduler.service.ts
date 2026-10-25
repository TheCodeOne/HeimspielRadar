import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  GERMAN_BASKETBALL_VERBAENDE,
  VerbandInfo,
} from '@sundayleague/shared-types';
import { getActiveVerbaende, ScraperService } from './scraper.service';

export interface ActiveVerband {
  id: number;
  name: string;
}

export const ALL_VERBAENDE: readonly ActiveVerband[] =
  GERMAN_BASKETBALL_VERBAENDE.map((v) => ({
    id: v.id,
    name: v.name,
  }));

export const ACTIVE_VERBAENDE: readonly ActiveVerband[] = ALL_VERBAENDE;

export { getActiveVerbaende, type VerbandInfo };

const CRON_DEEP_SCHEDULE = process.env['CRON_DEEP_SCHEDULE'] || '0 2 * * 2';
const CRON_DELTA_SCHEDULE = process.env['CRON_DELTA_SCHEDULE'] || '0 5,18 * * *';

@Injectable()
export class ScraperSchedulerService {
  private readonly logger = new Logger(ScraperSchedulerService.name);
  private isSyncRunning = false;

  constructor(private readonly scraperService: ScraperService) {}

  get isRunning(): boolean {
    return this.isSyncRunning || this.scraperService.isSyncActive();
  }

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
   * Daily Delta Sync: Frequent sync using Two-Tier Delta-Sync across all nationwide associations.
   * Default: Runs at 05:00 and 18:00 daily (configurable via CRON_DELTA_SCHEDULE).
   */
  @Cron(CRON_DELTA_SCHEDULE, { name: 'daily-verband-delta-sync' })
  async handleDailyDeltaSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Daily delta sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning || this.scraperService.isSyncActive()) {
      this.logger.warn(
        'Daily delta sync skipped because another sync is currently active.'
      );

      return;
    }

    this.logger.log(
      'Starting scheduled daily delta sync for all nationwide associations...'
    );
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.executeAuditedSync({
        type: 'delta',
        target: 'all',
      });

      this.logger.log(
        `Scheduled daily delta sync completed in ${result.durationMs}ms: ` +
          `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
          `${result.syncedMatches} matches updated.`
      );
    } catch (error) {
      this.logger.error('Scheduled daily delta sync failed:', error);
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Weekly Deep Sync: Discovers all leagues and updates full schedules across all nationwide associations.
   * Default: Runs every Tuesday at 02:00 AM (configurable via CRON_DEEP_SCHEDULE).
   */
  @Cron(CRON_DEEP_SCHEDULE, { name: 'weekly-bawue-full-sync' })
  async handleWeeklyDeepSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Weekly deep sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning || this.scraperService.isSyncActive()) {
      this.logger.warn(
        'Weekly deep sync skipped because another sync is currently active.'
      );

      return;
    }

    this.logger.log(
      'Starting scheduled weekly deep sync for all nationwide associations...'
    );
    this.isSyncRunning = true;

    try {
      const result = await this.scraperService.executeAuditedSync({
        type: 'deep',
        target: 'all',
      });

      this.logger.log(
        `Scheduled weekly deep sync completed in ${result.durationMs}ms: ` +
          `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
          `${result.syncedMatches} matches synced, ${result.geocodedVenues} venues geocoded.`
      );
    } catch (error) {
      this.logger.error('Scheduled weekly deep sync failed:', error);
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Backward-compatible alias for handleWeeklyDeepSync.
   */
  async handleWeeklyFullSync(): Promise<void> {
    return this.handleWeeklyDeepSync();
  }

  /**
   * Harmonized alias for handleDailyDeltaSync.
   */
  async handleWeekendMatchSync(): Promise<void> {
    return this.handleDailyDeltaSync();
  }
}
