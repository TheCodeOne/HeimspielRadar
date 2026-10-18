import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { ScraperService } from '../scraper/scraper.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

class FakeScraperService {
  getLastSyncedAt = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
}

describe('HealthController and HealthService', () => {
  let controller: HealthController;
  let service: HealthService;
  let fakeScraperService: FakeScraperService;

  beforeEach(async () => {
    fakeScraperService = new FakeScraperService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ScraperService,
          useValue: fakeScraperService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  describe('HealthService', () => {
    it('should return status ok with null lastSyncedAt when never synced', async () => {
      fakeScraperService.getLastSyncedAt.mockResolvedValueOnce(null);

      const result: HealthCheckResponse = await service.check();

      expect(result.status).toBe('ok');
      expect(result.lastSyncedAt).toBeNull();
      expect(result.timestamp).toBeDefined();
    });

    it('should return status ok with lastSyncedAt from scraper service', async () => {
      const syncTimestamp = '2026-10-18T12:00:00.000Z';
      fakeScraperService.getLastSyncedAt.mockResolvedValueOnce(syncTimestamp);

      const result: HealthCheckResponse = await service.check();

      expect(result.status).toBe('ok');
      expect(result.lastSyncedAt).toBe(syncTimestamp);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('HealthController', () => {
    it('should call healthService.check and return health response', async () => {
      const syncTimestamp = '2026-10-18T14:30:00.000Z';
      fakeScraperService.getLastSyncedAt.mockResolvedValueOnce(syncTimestamp);

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.lastSyncedAt).toBe(syncTimestamp);
      expect(result.timestamp).toBeDefined();
    });
  });
});
