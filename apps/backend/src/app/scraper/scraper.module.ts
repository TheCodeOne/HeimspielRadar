import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DbbClientService } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { ScraperController } from './scraper.controller';
import { ScraperAuthGuard } from './scraper-auth.guard';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperService } from './scraper.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScraperController],
  providers: [
    DbbClientService,
    GeocoderService,
    ScraperService,
    ScraperSchedulerService,
    ScraperAuthGuard,
  ],
  exports: [
    ScraperService,
    DbbClientService,
    GeocoderService,
    ScraperSchedulerService,
    ScraperAuthGuard,
  ],
})
export class ScraperModule {}
