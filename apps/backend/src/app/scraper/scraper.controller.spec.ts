import { Test, TestingModule } from '@nestjs/testing';
import { SyncResult, VerbandSyncResult } from '@sundayleague/shared-types';
import { ScraperAuthGuard } from './scraper-auth.guard';
import { ScraperController } from './scraper.controller';
import { ScraperService, SyncLeagueOptions, SyncVerbandOptions } from './scraper.service';

class FakeScraperService {
  previewLeague = jest.fn().mockResolvedValue({
    league: { ligaId: 53941, liganame: 'Kreisliga A' },
    totalMatches: 20,
    sampleMatch: null,
    sampleVenue: null,
  });

  syncLeague = jest.fn<Promise<SyncResult>, [number, SyncLeagueOptions | undefined]>().mockResolvedValue({
    leagueId: 53941,
    leagueName: 'Kreisliga A',
    totalMatches: 20,
    syncedMatches: 20,
    syncedVenues: 2,
    geocodedVenues: 1,
    durationMs: 50,
  });

  syncVerbandLeagues = jest.fn<Promise<VerbandSyncResult>, [number, SyncVerbandOptions | undefined]>().mockResolvedValue({
    verbandId: 1,
    totalLeagues: 280,
    successfulLeagues: 280,
    failedLeagues: 0,
    totalMatches: 15000,
    syncedMatches: 15000,
    syncedVenues: 500,
    geocodedVenues: 100,
    durationMs: 4500,
  });

  syncLeagueDelta = jest.fn().mockResolvedValue({
    success: true,
    leagueId: 53941,
    leagueName: 'Kreisliga A',
    totalMatches: 20,
    syncedMatches: 20,
    matchesCount: 20,
    verifiedMatches: 5,
    provisionalMatches: 15,
    syncedVenues: 2,
    geocodedVenues: 1,
    durationMs: 40,
  });

  syncVerbandDelta = jest.fn().mockResolvedValue({
    durationMs: 3000,
    successfulLeagues: 280,
    totalLeagues: 280,
    syncedMatches: 1200,
    errors: [],
  });

  getFailures = jest.fn().mockResolvedValue([
    {
      id: 1,
      entityType: 'league',
      dbbLeagueId: 53941,
      leagueName: 'Kreisliga A',
      dbbMatchId: null,
      verbandId: 1,
      errorMessage: 'Network timeout',
      retryCount: 0,
      failedAt: new Date('2026-10-19T10:00:00Z'),
      updatedAt: new Date('2026-10-19T10:00:00Z'),
    },
  ]);

  retryFailed = jest.fn().mockResolvedValue({
    retriedCount: 1,
    resolvedCount: 1,
    stillFailingCount: 0,
    failures: [],
    retriedLeagues: 1,
    resolved: 1,
    stillFailing: 0,
  });
}

describe('ScraperController', () => {
  let controller: ScraperController;
  let fakeScraperService: FakeScraperService;

  beforeEach(async () => {
    fakeScraperService = new FakeScraperService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScraperController],
      providers: [
        {
          provide: ScraperService,
          useValue: fakeScraperService,
        },
      ],
    })
      .overrideGuard(ScraperAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ScraperController>(ScraperController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return operational status', () => {
      const status = controller.getStatus();

      expect(status.status).toBe('ok');
      expect(status.service).toBe('Sundayleague DBB Scraper');
    });
  });

  describe('getFailures', () => {
    it('should return current failed sync records without query params', async () => {
      const failures = await controller.getFailures();

      expect(fakeScraperService.getFailures).toHaveBeenCalledWith(undefined);
      expect(failures).toHaveLength(1);
      expect(failures[0].dbbLeagueId).toBe(53941);
    });

    it('should pass parsed verbandId query parameter to scraperService.getFailures', async () => {
      await controller.getFailures('1');

      expect(fakeScraperService.getFailures).toHaveBeenCalledWith({ verbandId: 1 });
    });
  });

  describe('previewLeague', () => {
    it('should call scraperService.previewLeague with parsed leagueId', async () => {
      const result = await controller.previewLeague(53941);

      expect(fakeScraperService.previewLeague).toHaveBeenCalledWith(53941);
      expect(result.league.ligaId).toBe(53941);
    });
  });

  describe('syncLeague', () => {
    it('should call scraperService.syncLeague with parsed leagueId', async () => {
      const result = await controller.syncLeague(53941);

      expect(fakeScraperService.syncLeague).toHaveBeenCalledWith(53941);
      expect(result.leagueId).toBe(53941);
    });
  });

  describe('syncVerband', () => {
    it('should call scraperService.syncVerbandLeagues with default options', async () => {
      const result = await controller.syncVerband(1);

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledWith(1, {
        quickSync: false,
        concurrency: undefined,
      });
      expect(result.verbandId).toBe(1);
      expect(result.totalLeagues).toBe(280);
    });

    it('should parse quickSync and concurrency query params correctly', async () => {
      await controller.syncVerband(1, 'true', '5');

      expect(fakeScraperService.syncVerbandLeagues).toHaveBeenCalledWith(1, {
        quickSync: true,
        concurrency: 5,
      });
    });
  });

  describe('syncLeagueDelta', () => {
    it('should call scraperService.syncLeagueDelta with parsed liganr and default options', async () => {
      const result = await controller.syncLeagueDelta(53941);

      expect(fakeScraperService.syncLeagueDelta).toHaveBeenCalledWith(53941, undefined);
      expect(result.leagueId).toBe(53941);
      expect(result.verifiedMatches).toBe(5);
    });

    it('should pass parsed rangeDays query parameter', async () => {
      await controller.syncLeagueDelta(53941, '14');

      expect(fakeScraperService.syncLeagueDelta).toHaveBeenCalledWith(53941, {
        rangeDays: 14,
      });
    });
  });

  describe('syncVerbandDelta', () => {
    it('should call scraperService.syncVerbandDelta with default options', async () => {
      const result = await controller.syncVerbandDelta(1);

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledWith(1, {
        rangeDays: undefined,
        concurrency: undefined,
      });
      expect(result.successfulLeagues).toBe(280);
    });

    it('should pass parsed rangeDays and concurrency query params', async () => {
      await controller.syncVerbandDelta(1, '21', '8');

      expect(fakeScraperService.syncVerbandDelta).toHaveBeenCalledWith(1, {
        rangeDays: 21,
        concurrency: 8,
      });
    });
  });

  describe('retryFailed', () => {
    it('should call scraperService.retryFailed without options when no query/body provided', async () => {
      const result = await controller.retryFailed();

      expect(fakeScraperService.retryFailed).toHaveBeenCalledWith(undefined);
      expect(result.retriedCount).toBe(1);
      expect(result.resolvedCount).toBe(1);
    });

    it('should pass parsed verbandId from query param', async () => {
      await controller.retryFailed('1');

      expect(fakeScraperService.retryFailed).toHaveBeenCalledWith({ verbandId: 1 });
    });

    it('should pass parsed verbandId from request body', async () => {
      await controller.retryFailed(undefined, { verbandId: 2 });

      expect(fakeScraperService.retryFailed).toHaveBeenCalledWith({ verbandId: 2 });
    });
  });
});
