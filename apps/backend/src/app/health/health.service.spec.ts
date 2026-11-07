import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { ScraperService } from '../scraper/scraper.service';
import { HealthService } from './health.service';

class FakeScraperService {
  getLastSyncedAt = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
}

describe('HealthService', () => {
  let service: HealthService;
  let fakeScraperService: FakeScraperService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    fakeScraperService = new FakeScraperService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ScraperService,
          useValue: fakeScraperService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return default health stats including version, commitSha, and uptimeSeconds', async () => {
    const result: HealthCheckResponse = await service.check();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.lastSyncedAt).toBeNull();
    expect(result.version).toEqual(expect.any(String));
    expect(result.version.length).toBeGreaterThan(0);
    expect(result.commitSha).toEqual(expect.any(String));
    expect(result.commitSha.length).toBeLessThanOrEqual(7);
    expect(result.uptimeSeconds).toEqual(expect.any(Number));
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.builtAt).toBeNull();
  });

  it('should include lastSyncedAt when provided by scraperService', async () => {
    const syncTime = '2026-11-07T10:00:00.000Z';
    fakeScraperService.getLastSyncedAt.mockResolvedValueOnce(syncTime);

    const result = await service.check();

    expect(result.lastSyncedAt).toBe(syncTime);
  });

  it('should honor BACKEND_VERSION, GIT_COMMIT_SHA, and BUILD_TIMESTAMP environment variables', async () => {
    process.env.BACKEND_VERSION = '0.4.2';
    process.env.GIT_COMMIT_SHA = 'abcdef1234567890';
    process.env.BUILD_TIMESTAMP = '2026-11-07T12:34:56.789Z';

    const result = await service.check();

    expect(result.version).toBe('0.4.2');
    expect(result.commitSha).toBe('abcdef1'); // Truncated to 7 chars
    expect(result.builtAt).toBe('2026-11-07T12:34:56.789Z');
  });
});
