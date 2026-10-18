import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DbbClientService } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScraperController],
  providers: [DbbClientService, GeocoderService, ScraperService],
  exports: [ScraperService, DbbClientService, GeocoderService],
})
export class ScraperModule {}
