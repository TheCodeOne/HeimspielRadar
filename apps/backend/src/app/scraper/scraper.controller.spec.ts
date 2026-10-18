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
});
