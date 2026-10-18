import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScraperAuthGuard } from './scraper-auth.guard';
import { ScraperService } from './scraper.service';

@Controller('scraper')
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'ok',
      service: 'Sundayleague DBB Scraper',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('preview/:leagueId')
  async previewLeague(@Param('leagueId', ParseIntPipe) leagueId: number) {
    return this.scraperService.previewLeague(leagueId);
  }

  @Post('sync/:leagueId')
  @UseGuards(ScraperAuthGuard)
  async syncLeague(@Param('leagueId', ParseIntPipe) leagueId: number) {
    return this.scraperService.syncLeague(leagueId);
  }

  @Post('sync/verband/:verbandId')
  @UseGuards(ScraperAuthGuard)
  async syncVerband(
    @Param('verbandId', ParseIntPipe) verbandId: number,
    @Query('quickSync') quickSync?: string,
    @Query('concurrency') concurrency?: string
  ) {
    const isQuickSync = quickSync === 'true';
    const parsedConcurrency = concurrency ? parseInt(concurrency, 10) : undefined;

    return this.scraperService.syncVerbandLeagues(verbandId, {
      quickSync: isQuickSync,
      concurrency: parsedConcurrency,
    });
  }

  @Post('geocode-missing')
  @UseGuards(ScraperAuthGuard)
  async geocodeMissing() {
    return this.scraperService.geocodeMissingVenues();
  }
}
