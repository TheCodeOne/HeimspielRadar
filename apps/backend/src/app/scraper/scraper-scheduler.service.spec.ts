import { Test, TestingModule } from '@nestjs/testing';
import {
  SyncVerbandDeltaResult,
  VerbandSyncResult,
} from '@sundayleague/shared-types';
import {
  ACTIVE_VERBAENDE,
  ScraperSchedulerService,
} from './scraper-scheduler.service';
import { ScraperService, SyncVerbandOptions } from './scraper.service';

class FakeScraperService {
  syncVerbandDelta = jest.fn().mockImplementation(
    async (): Promise<SyncVerbandDeltaResult> => ({
      durationMs: 100,
      successfulLeagues: 5,
      totalLeagues: 5,
      syncedMatches: 25,
      errors: [],
      leagueResults: [],
    })
  );

  syncVerbandLeagues = jest.fn().mockImplementation(
    async (
      verbandId: number,
      _options?: SyncVerbandOptions
    ): Promise<VerbandSyncResult> => ({
      verbandId,
      totalLeagues: 10,
      successfulLeagues: 10,
      failedLeagues: 0,
      totalMatches: 100,
      syncedMatches: 100,
      syncedVenues: 20,
      geocodedVenues: 5,
      durationMs: 120,
    })
  );

  syncAllBawueLeagues = jest.fn().mockImplementation(
    async (options?: SyncVerbandOptions): Promise<VerbandSyncResult> =>
      this.syncVerbandLeagues(1, options)
  );
}

describe('ScraperSchedulerService', () => {
  let scheduler: ScraperSchedulerService;
  let fakeScraperService: FakeScraperService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    fakeScraperService = new FakeScraperService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperSchedulerService,
        {
          provide: ScraperService,
          useValue: fakeScraperService,
        },
      ],
    }).compile();

    scheduler = module.get<ScraperSchedulerService>(ScraperSchedulerService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
    expect(scheduler.isRunning).toBe(false);
  });

  it('should define active associations with BBW (1) and Regionalliga Südwest (31)', () => {
    expect(ACTIVE_VERBAENDE).toEqual([
      { id: 1, name: 'Baden-Württemberg (BBW)' },
      { id: 31, name: 'Regionalliga Südwest e.V.' },
    ]);
  });

  describe('handleDailyDeltaSync', () => {
    it('should trigger delta sync for both Verband 1 and Verband 31 when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
      expect(fakeScraperService.syncVerbandDelta).toHaveBeenNthCalledWith(1, 1);
      expect(fakeScraperService.syncVerbandDelta).toHaveBeenNthCalledWith(2, 31);
    });

    it('should trigger delta sync when ENABLE_CRON_SYNC is explicitly true', async () => {
      delete process.env['DISABLE_CRON'];
      process.env['ENABLE_CRON_SYNC'] = 'true';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
    });

    it('should skip delta sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.syncVerbandDelta).not.toHaveBeenCalled();
    });

    it('should skip delta sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.syncVerbandDelta).not.toHaveBeenCalled();
    });

    it('should not allow overlapping delta syncs via isSyncRunning lock', async () => {
      delete process.env['DISABLE_CRON'];

      let resolveSync: ((val: SyncVerbandDeltaResult) => void) | undefined;

      const delayedPromise = new Promise<SyncVerbandDeltaResult>((resolve) => {
        resolveSync = resolve;
      });

      fakeScraperService.syncVerbandDelta.mockReturnValueOnce(delayedPromise);

      const firstSync = scheduler.handleDailyDeltaSync();
      const secondSync = scheduler.handleDailyDeltaSync();

      // Second sync should have been skipped immediately while first was running
      expect(scheduler.isRunning).toBe(true);

      resolveSync!({
        durationMs: 50,
        successfulLeagues: 1,
        totalLeagues: 1,
        syncedMatches: 5,
        errors: [],
        leagueResults: [],
      });

      await Promise.all([firstSync, secondSync]);

      // Only the first sync executed across the 2 associations
      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
      expect(scheduler.isRunning).toBe(false);
    });

    it('should isolate errors so exceptions in one association do not crash scheduler or stop remaining associations', async () => {
      delete process.env['DISABLE_CRON'];

      fakeScraperService.syncVerbandDelta
        .mockRejectedValueOnce(new Error('DBB API timeout for Verband 1'))
        .mockResolvedValueOnce({
          durationMs: 80,
          successfulLeagues: 2,
          totalLeagues: 2,
          syncedMatches: 10,
          errors: [],
          leagueResults: [],
        });

      await expect(scheduler.handleDailyDeltaSync()).resolves.not.toThrow();

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
      expect(fakeScraperService.syncVerbandDelta).toHaveBeenNthCalledWith(1, 1);
      expect(fakeScraperService.syncVerbandDelta).toHaveBeenNthCalledWith(2, 31);
      expect(scheduler.isRunning).toBe(false);
    });

    it('should safely release lock even if all associations throw errors', async () => {
      delete process.env['DISABLE_CRON'];

      fakeScraperService.syncVerbandDelta.mockRejectedValue(
        new Error('Network catastrophic outage')
      );

      await expect(scheduler.handleDailyDeltaSync()).resolves.not.toThrow();

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('handleWeeklyDeepSync', () => {
    it('should trigger deep sync for both Verband 1 and Verband 31 with quickSync false', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledTimes(2);
      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenNthCalledWith(
        1,
        1,
        { quickSync: false }
      );
      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenNthCalledWith(
        2,
        31,
        { quickSync: false }
      );
    });

    it('should skip deep sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.syncVerbandLeagues).not.toHaveBeenCalled();
    });

    it('should skip deep sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.syncVerbandLeagues).not.toHaveBeenCalled();
    });

    it('should not allow overlapping deep syncs via isSyncRunning lock', async () => {
      delete process.env['DISABLE_CRON'];

      let resolveSync: ((val: VerbandSyncResult) => void) | undefined;

      const delayedPromise = new Promise<VerbandSyncResult>((resolve) => {
        resolveSync = resolve;
      });

      fakeScraperService.syncVerbandLeagues.mockReturnValueOnce(delayedPromise);

      const firstSync = scheduler.handleWeeklyDeepSync();
      const secondSync = scheduler.handleWeeklyDeepSync();

      expect(scheduler.isRunning).toBe(true);

      resolveSync!({
        verbandId: 1,
        totalLeagues: 1,
        successfulLeagues: 1,
        failedLeagues: 0,
        totalMatches: 10,
        syncedMatches: 10,
        syncedVenues: 2,
        geocodedVenues: 1,
        durationMs: 50,
      });

      await Promise.all([firstSync, secondSync]);

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledTimes(2);
      expect(scheduler.isRunning).toBe(false);
    });

    it('should isolate errors during deep sync without throwing', async () => {
      delete process.env['DISABLE_CRON'];

      fakeScraperService.syncVerbandLeagues
        .mockRejectedValueOnce(new Error('Network error on Verband 1'))
        .mockResolvedValueOnce({
          verbandId: 31,
          totalLeagues: 5,
          successfulLeagues: 5,
          failedLeagues: 0,
          totalMatches: 20,
          syncedMatches: 20,
          syncedVenues: 5,
          geocodedVenues: 0,
          durationMs: 75,
        });

      await expect(scheduler.handleWeeklyDeepSync()).resolves.not.toThrow();

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledTimes(2);
      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenNthCalledWith(
        1,
        1,
        { quickSync: false }
      );
      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenNthCalledWith(
        2,
        31,
        { quickSync: false }
      );
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('cross-sync concurrency lock', () => {
    it('should block deep sync when delta sync is currently active', async () => {
      delete process.env['DISABLE_CRON'];

      let resolveDelta: ((val: SyncVerbandDeltaResult) => void) | undefined;

      const delayedDelta = new Promise<SyncVerbandDeltaResult>((resolve) => {
        resolveDelta = resolve;
      });

      fakeScraperService.syncVerbandDelta.mockReturnValueOnce(delayedDelta);

      const deltaSync = scheduler.handleDailyDeltaSync();
      const deepSync = scheduler.handleWeeklyDeepSync();

      expect(scheduler.isRunning).toBe(true);

      resolveDelta!({
        durationMs: 20,
        successfulLeagues: 1,
        totalLeagues: 1,
        syncedMatches: 2,
        errors: [],
        leagueResults: [],
      });

      await Promise.all([deltaSync, deepSync]);

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
      expect(fakeScraperService.syncVerbandLeagues).not.toHaveBeenCalled();
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('backwards compatibility wrappers', () => {
    it('handleWeeklyFullSync should delegate to handleWeeklyDeepSync', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledTimes(2);
    });

    it('handleWeekendMatchSync should delegate to handleDailyDeltaSync', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledTimes(2);
    });
  });
});
