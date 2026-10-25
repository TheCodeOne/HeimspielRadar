import { Test, TestingModule } from '@nestjs/testing';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperService } from './scraper.service';

class FakeScraperService {
  executeAuditedSyncCallCount = 0;
  lastAuditedParams?: { type: string; target: string };
  isSyncRunning = false;

  isSyncActive(): boolean {
    return this.isSyncRunning;
  }

  async executeAuditedSync(params: {
    type: 'delta' | 'deep' | 'manual';
    target: string;
  }): Promise<any> {
    this.executeAuditedSyncCallCount++;
    this.lastAuditedParams = params;

    return {
      id: 1,
      syncType: params.type,
      target: params.target,
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 120,
      totalLeagues: 10,
      successfulLeagues: 10,
      syncedMatches: 100,
      geocodedVenues: 5,
      failuresCount: 0,
      status: 'success',
      errorMessage: null,
      createdAt: new Date(),
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

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'deep',
        target: 'verband:1',
      });
    });

    it('should skip sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should skip sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should not allow overlapping syncs', async () => {
      delete process.env['DISABLE_CRON'];

      let resolveSync: ((val: any) => void) | undefined;

      const delayedPromise = new Promise<any>((resolve) => {
        resolveSync = resolve;
      });

      fakeScraperService.executeAuditedSync = jest.fn().mockImplementation(() => delayedPromise);

      const firstSync = scheduler.handleWeeklyFullSync();
      const secondSync = scheduler.handleWeeklyFullSync();

      // Complete the first sync
      resolveSync!({
        id: 1,
        syncType: 'deep',
        target: 'verband:1',
        totalLeagues: 1,
        successfulLeagues: 1,
        syncedMatches: 10,
        geocodedVenues: 1,
        durationMs: 50,
      });

      await Promise.all([firstSync, secondSync]);

      expect(fakeScraperService.executeAuditedSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleWeekendMatchSync', () => {
    it('should trigger quick match sync when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'delta',
        target: 'verband:1',
      });
    });

    it('should skip quick sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should skip quick sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });
  });
});
