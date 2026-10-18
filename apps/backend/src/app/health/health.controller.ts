import { Controller, Get } from '@nestjs/common';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }
}
