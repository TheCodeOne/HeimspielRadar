import { Test, TestingModule } from '@nestjs/testing';
import { VerbandSyncResult } from '@sundayleague/shared-types';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperService, SyncVerbandOptions } from './scraper.service';

class FakeScraperService {
  syncAllBawueLeaguesCallCount = 0;
  lastOptions?: SyncVerbandOptions;

  async syncAllBawueLeagues(options?: SyncVerbandOptions): Promise<VerbandSyncResult> {
    this.syncAllBawueLeaguesCallCount++;
    this.lastOptions = options;

    return {
      verbandId: 1,
      totalLeagues: 10,
      successfulLeagues: 10,
      failedLeagues: 0,
      totalMatches: 100,
      syncedMatches: 100,
      syncedVenues: 20,
      geocodedVenues: 5,
      durationMs: 120,
    };
  }
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
  });

  describe('handleWeeklyFullSync', () => {
    it('should trigger full sync when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.syncAllBawueLeaguesCallCount).toBe(1);
      expect(fakeScraperService.lastOptions).toEqual({ quickSync: false });
    });

    it('should skip sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.syncAllBawueLeaguesCallCount).toBe(0);
    });

    it('should not allow overlapping syncs', async () => {
      delete process.env['DISABLE_CRON'];

      let resolveSync: ((val: VerbandSyncResult) => void) | undefined;

      const delayedPromise = new Promise<VerbandSyncResult>((resolve) => {
        resolveSync = resolve;
      });

      fakeScraperService.syncAllBawueLeagues = jest.fn().mockImplementation(() => delayedPromise);

      const firstSync = scheduler.handleWeeklyFullSync();
      const secondSync = scheduler.handleWeeklyFullSync();

      // Complete the first sync
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

      expect(fakeScraperService.syncAllBawueLeagues).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleWeekendMatchSync', () => {
    it('should trigger quick match sync when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.syncAllBawueLeaguesCallCount).toBe(1);
      expect(fakeScraperService.lastOptions).toEqual({ quickSync: true });
    });

    it('should skip quick sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.syncAllBawueLeaguesCallCount).toBe(0);
    });
  });
});
