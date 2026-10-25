import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminApiGuard } from './admin-api.guard';
import { AdminController } from './admin.controller';
import { DbbClientService } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { ScraperAuthGuard } from './scraper-auth.guard';
import { ScraperController } from './scraper.controller';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperService } from './scraper.service';
import { TelegramNotifierService } from './telegram-notifier.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScraperController, AdminController],
  providers: [
    DbbClientService,
    GeocoderService,
    ScraperService,
    ScraperSchedulerService,
    ScraperAuthGuard,
    AdminApiGuard,
    TelegramNotifierService,
  ],
  exports: [
    ScraperService,
    DbbClientService,
    GeocoderService,
    ScraperSchedulerService,
    ScraperAuthGuard,
    AdminApiGuard,
    TelegramNotifierService,
  ],
})
export class ScraperModule {}
