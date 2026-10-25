import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScraperService } from './scraper.service';

export interface ActiveVerband {
  id: number;
  name: string;
}

export const ACTIVE_VERBAENDE: readonly ActiveVerband[] = [
  { id: 1, name: 'Baden-Württemberg (BBW)' },
  { id: 31, name: 'Regionalliga Südwest e.V.' },
];

const CRON_DEEP_SCHEDULE = process.env['CRON_DEEP_SCHEDULE'] || '0 2 * * 2';
const CRON_DELTA_SCHEDULE = process.env['CRON_DELTA_SCHEDULE'] || '0 5,18 * * *';

@Injectable()
export class ScraperSchedulerService {
  private readonly logger = new Logger(ScraperSchedulerService.name);
  private isSyncRunning = false;

  constructor(private readonly scraperService: ScraperService) {}

  get isRunning(): boolean {
    return this.isSyncRunning;
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
   * Daily Delta Sync: Frequent sync using Two-Tier Delta-Sync across active associations.
   * Default: Runs at 05:00 and 18:00 daily (configurable via CRON_DELTA_SCHEDULE).
   */
  @Cron(CRON_DELTA_SCHEDULE, { name: 'daily-verband-delta-sync' })
  async handleDailyDeltaSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Daily delta sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning) {
      this.logger.warn('Daily delta sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled daily delta sync for active associations...');
    this.isSyncRunning = true;
    const startTime = Date.now();
    let totalUpdatedMatches = 0;
    let totalSuccessfulLeagues = 0;
    let totalLeagues = 0;
    let totalErrors = 0;

    try {
      for (const verband of ACTIVE_VERBAENDE) {
        try {
          this.logger.log(
            `Starting delta sync for ${verband.name} (Verband ${verband.id})...`
          );

          const result = await this.scraperService.syncVerbandDelta(verband.id);

          totalUpdatedMatches += result.syncedMatches;
          totalSuccessfulLeagues += result.successfulLeagues;
          totalLeagues += result.totalLeagues;
          totalErrors += result.errors.length;

          this.logger.log(
            `Delta sync completed for ${verband.name} (Verband ${verband.id}) in ${result.durationMs}ms: ` +
              `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
              `${result.syncedMatches} matches synced (${result.errors.length} league errors).`
          );
        } catch (error) {
          totalErrors++;
          this.logger.error(
            `Failed delta sync for ${verband.name} (Verband ${verband.id}):`,
            error
          );
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.log(
        `Scheduled daily delta sync completed across all associations in ${durationMs}ms: ` +
          `${totalSuccessfulLeagues}/${totalLeagues} leagues, ` +
          `${totalUpdatedMatches} matches updated (${totalErrors} total errors).`
      );
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Weekly Deep Sync: Discovers all leagues and updates full schedules across active associations.
   * Default: Runs every Tuesday at 02:00 AM (configurable via CRON_DEEP_SCHEDULE).
   */
  @Cron(CRON_DEEP_SCHEDULE, { name: 'weekly-bawue-full-sync' })
  async handleWeeklyDeepSync(): Promise<void> {
    if (this.isCronDisabled()) {
      this.logger.log('Weekly deep sync skipped (cron is disabled).');

      return;
    }

    if (this.isSyncRunning) {
      this.logger.warn('Weekly deep sync skipped because another sync is currently active.');

      return;
    }

    this.logger.log('Starting scheduled weekly deep sync for active associations...');
    this.isSyncRunning = true;
    const startTime = Date.now();
    let totalSyncedMatches = 0;
    let totalSuccessfulLeagues = 0;
    let totalLeagues = 0;
    let totalGeocodedVenues = 0;
    let totalErrors = 0;

    try {
      for (const verband of ACTIVE_VERBAENDE) {
        try {
          this.logger.log(
            `Starting weekly deep sync for ${verband.name} (Verband ${verband.id})...`
          );

          const result = await this.scraperService.syncVerbandLeagues(verband.id, {
            quickSync: false,
          });

          totalSyncedMatches += result.syncedMatches;
          totalSuccessfulLeagues += result.successfulLeagues;
          totalLeagues += result.totalLeagues;
          totalGeocodedVenues += result.geocodedVenues;

          this.logger.log(
            `Scheduled weekly deep sync completed for ${verband.name} in ${result.durationMs}ms: ` +
              `${result.successfulLeagues}/${result.totalLeagues} leagues, ` +
              `${result.syncedMatches} matches synced, ${result.geocodedVenues} venues geocoded.`
          );
        } catch (error) {
          totalErrors++;
          this.logger.error(
            `Scheduled weekly deep sync failed for ${verband.name} (Verband ${verband.id}):`,
            error
          );
        }
      }

      const durationMs = Date.now() - startTime;

      this.logger.log(
        `Scheduled weekly deep sync completed across all associations in ${durationMs}ms: ` +
          `${totalSuccessfulLeagues}/${totalLeagues} leagues, ` +
          `${totalSyncedMatches} matches synced, ${totalGeocodedVenues} venues geocoded (${totalErrors} total errors).`
      );
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
