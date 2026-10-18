import { Module } from '@nestjs/common';
import { ScraperModule } from '../scraper/scraper.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ScraperModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
