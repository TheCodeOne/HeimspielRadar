import { Injectable } from '@nestjs/common';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { ScraperService } from '../scraper/scraper.service';

@Injectable()
export class HealthService {
  constructor(private readonly scraperService: ScraperService) {}

  async check(): Promise<HealthCheckResponse> {
    const lastSyncedAt = await this.scraperService.getLastSyncedAt();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      lastSyncedAt,
    };
  }
}
