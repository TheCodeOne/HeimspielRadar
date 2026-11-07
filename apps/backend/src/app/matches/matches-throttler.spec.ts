import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { CreateKioskSubmissionDto, HealthCheckResponse, Match } from '@sundayleague/shared-types';
import { HealthController } from '../health/health.controller';
import { HealthService } from '../health/health.service';
import { CloudflareThrottlerGuard } from '../throttler/cloudflare-throttler.guard';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

class FakeMatchesService {
  findMatches = jest.fn<Promise<Match[]>, []>().mockResolvedValue([]);
  findTeamSuggestions = jest.fn<Promise<string[]>, []>().mockResolvedValue(['FC Test']);
  findById = jest.fn<Promise<Match | null>, []>().mockResolvedValue(null);
  createKioskSubmission = jest.fn<Promise<{ id: number; success: boolean }>, []>().mockResolvedValue({
    id: 1,
    success: true,
  });
}

class FakeHealthService {
  check = jest.fn<Promise<HealthCheckResponse>, []>().mockResolvedValue({
    status: 'ok',
    timestamp: new Date().toISOString(),
    lastSyncedAt: null,
    version: '0.1.0',
    commitSha: 'dev',
    uptimeSeconds: 42,
    builtAt: null,
  });
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 3,
      },
    ]),
  ],
  controllers: [MatchesController, HealthController],
  providers: [
    {
      provide: MatchesService,
      useClass: FakeMatchesService,
    },
    {
      provide: HealthService,
      useClass: FakeHealthService,
    },
    {
      provide: APP_GUARD,
      useClass: CloudflareThrottlerGuard,
    },
  ],
})
class ThrottlerTestModule {}

describe('Tiered Throttler Integration', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(ThrottlerTestModule, { logger: false });
    app.setGlobalPrefix('api');

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);

    await app.listen(0);

    const address = app.getHttpServer().address();

    // SAFETY: NestJS HttpServer.address() returns AddressInfo object when listening on TCP port
    const port = (address as { port: number }).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Default Rate Limiting (limit: 3)', () => {
    it('should allow requests within limit and reject subsequent requests with 429', async () => {
      const clientIp = '198.51.100.1';

      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${baseUrl}/api/matches`, {
          headers: { 'cf-connecting-ip': clientIp },
        });

        expect(response.status).toBe(200);
      }

      const blockedResponse = await fetch(`${baseUrl}/api/matches`, {
        headers: { 'cf-connecting-ip': clientIp },
      });

      expect(blockedResponse.status).toBe(429);

      const retryAfter = blockedResponse.headers.get('retry-after');

      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);

      // SAFETY: 429 response body follows standard NestJS HttpException json schema
      const body = (await blockedResponse.json()) as { message: string; statusCode: number };

      expect(body.statusCode).toBe(429);
      expect(body.message).toContain('Too Many Requests. Please slow down.');
    });

    it('should isolate limits per client IP', async () => {
      const distinctIp = '198.51.100.2';

      const response = await fetch(`${baseUrl}/api/matches`, {
        headers: { 'cf-connecting-ip': distinctIp },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Teams Autosuggest Higher Limit Override', () => {
    it('should allow more requests than the default limit on /api/matches/teams', async () => {
      const autosuggestIp = '198.51.100.10';

      for (let i = 0; i < 6; i++) {
        const response = await fetch(`${baseUrl}/api/matches/teams?q=FC`, {
          headers: { 'cf-connecting-ip': autosuggestIp },
        });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Health Endpoint @SkipThrottle', () => {
    it('should never throttle health check requests', async () => {
      const healthMonitorIp = '198.51.100.99';

      for (let i = 0; i < 8; i++) {
        const response = await fetch(`${baseUrl}/api/health`, {
          headers: { 'cf-connecting-ip': healthMonitorIp },
        });

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Kiosk Submission Strict Throttle Limit', () => {
    it('should enforce limit on kiosk submissions', async () => {
      const submitterIp = '198.51.100.50';

      const payload: CreateKioskSubmissionDto = {
        kioskDescription: 'Kaffee und Kuchen vorhanden',
        admissionFee: 'Freier Eintritt',
        parkingNotes: 'Parkplätze vor der Halle',
        scope: 'matchday',
      };

      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/matches/101/kiosk-submission`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'cf-connecting-ip': submitterIp,
          },
          body: JSON.stringify(payload),
        });

        expect(response.status).toBe(201);
      }

      const blockedResponse = await fetch(`${baseUrl}/api/matches/101/kiosk-submission`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': submitterIp,
        },
        body: JSON.stringify(payload),
      });

      expect(blockedResponse.status).toBe(429);
    });
  });
});
