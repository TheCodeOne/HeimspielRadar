import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckResponse } from '@sundayleague/shared-types';
import { HealthService } from './health.service';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @SkipThrottle()
  @Get()
  async check(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }
}
