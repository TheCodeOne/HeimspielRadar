import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PushModule } from '../push/push.module';
import { AdminApiGuard } from './admin-api.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DbbClientService } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { ScraperAuthGuard } from './scraper-auth.guard';
import { ScraperController } from './scraper.controller';
import { ScraperSchedulerService } from './scraper-scheduler.service';
import { ScraperService } from './scraper.service';
import { TelegramNotifierService } from './telegram-notifier.service';
import { TopMatchScoringService } from './top-match-scoring.service';

@Module({
  imports: [DatabaseModule, PushModule],
  controllers: [ScraperController, AdminController],
  providers: [
    DbbClientService,
    GeocoderService,
    ScraperService,
    ScraperSchedulerService,
    ScraperAuthGuard,
    AdminApiGuard,
    AdminService,
    TelegramNotifierService,
    TopMatchScoringService,
  ],
  exports: [
    ScraperService,
    DbbClientService,
    GeocoderService,
    ScraperSchedulerService,
    ScraperAuthGuard,
    AdminApiGuard,
    AdminService,
    TelegramNotifierService,
    TopMatchScoringService,
  ],
})
export class ScraperModule {}
