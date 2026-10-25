import { Test, TestingModule } from '@nestjs/testing';
import {
  ACTIVE_VERBAENDE,
  ALL_VERBAENDE,
  getActiveVerbaende,
  ScraperSchedulerService,
} from './scraper-scheduler.service';
import { ScraperService } from './scraper.service';

class FakeScraperService {
  executeAuditedSyncCallCount = 0;
  lastAuditedParams?: { type: string; target: string };
  isSyncRunning = false;
  shouldThrowError = false;

  isSyncActive(): boolean {
    return this.isSyncRunning;
  }

  async executeAuditedSync(params: {
    type: 'delta' | 'deep' | 'manual';
    target: string;
  }) {
    this.executeAuditedSyncCallCount++;
    this.lastAuditedParams = params;

    if (this.shouldThrowError) {
      throw new Error('Database connection failed during audited sync');
    }

    return {
      id: 1,
      syncType: params.type,
      target: params.target,
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 120,
      totalLeagues: 250,
      successfulLeagues: 248,
      syncedMatches: 1250,
      geocodedVenues: 15,
      failuresCount: 2,
      status: 'partial' as const,
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
    expect(scheduler.isRunning).toBe(false);
  });

  it('should define all 23 nationwide German basketball associations', () => {
    expect(ALL_VERBAENDE.length).toBe(23);
    expect(ACTIVE_VERBAENDE.length).toBe(23);

    const ids = ALL_VERBAENDE.map((v) => v.id);

    // Bundesligen & Nationale
    expect(ids).toContain(100);
    expect(ids).toContain(29);

    // 4 Regionalligen
    expect(ids).toContain(30);
    expect(ids).toContain(31);
    expect(ids).toContain(32);
    expect(ids).toContain(33);

    // 16 Landesverbände
    for (let id = 1; id <= 16; id++) {
      expect(ids).toContain(id);
    }

    // Rollstuhlbasketball
    expect(ids).toContain(40);
  });

  it('should respect ACTIVE_VERBAND_IDS environment override in getActiveVerbaende', () => {
    process.env['ACTIVE_VERBAND_IDS'] = '1,31';

    const filtered = getActiveVerbaende();

    expect(filtered.length).toBe(2);
    expect(filtered.map((v) => v.id)).toEqual([31, 1]);
  });

  describe('handleDailyDeltaSync', () => {
    it('should trigger delta sync for all nationwide associations when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'delta',
        target: 'all',
      });
    });

    it('should trigger delta sync when ENABLE_CRON_SYNC is explicitly true', async () => {
      delete process.env['DISABLE_CRON'];
      process.env['ENABLE_CRON_SYNC'] = 'true';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'delta',
        target: 'all',
      });
    });

    it('should skip delta sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should skip delta sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should skip delta sync if scraperService.isSyncActive() is true', async () => {
      delete process.env['DISABLE_CRON'];
      fakeScraperService.isSyncRunning = true;

      await scheduler.handleDailyDeltaSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should handle errors gracefully without throwing', async () => {
      delete process.env['DISABLE_CRON'];
      fakeScraperService.shouldThrowError = true;

      await expect(scheduler.handleDailyDeltaSync()).resolves.toBeUndefined();
      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('handleWeeklyDeepSync', () => {
    it('should trigger deep sync for all nationwide associations when cron is enabled', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'deep',
        target: 'all',
      });
    });

    it('should skip deep sync when DISABLE_CRON is true', async () => {
      process.env['DISABLE_CRON'] = 'true';

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should skip deep sync when ENABLE_CRON_SYNC is false', async () => {
      process.env['ENABLE_CRON_SYNC'] = 'false';

      await scheduler.handleWeeklyDeepSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(0);
    });

    it('should handle deep sync errors gracefully without throwing', async () => {
      delete process.env['DISABLE_CRON'];
      fakeScraperService.shouldThrowError = true;

      await expect(scheduler.handleWeeklyDeepSync()).resolves.toBeUndefined();
      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('backward-compatible aliases', () => {
    it('handleWeeklyFullSync should delegate to handleWeeklyDeepSync', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeeklyFullSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'deep',
        target: 'all',
      });
    });

    it('handleWeekendMatchSync should delegate to handleDailyDeltaSync', async () => {
      delete process.env['DISABLE_CRON'];

      await scheduler.handleWeekendMatchSync();

      expect(fakeScraperService.executeAuditedSyncCallCount).toBe(1);
      expect(fakeScraperService.lastAuditedParams).toEqual({
        type: 'delta',
        target: 'all',
      });
    });
  });
});
