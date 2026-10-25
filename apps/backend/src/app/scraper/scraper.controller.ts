import {
  Body,
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

  @Get('failures')
  async getFailures(@Query('verbandId') verbandId?: string) {
    const parsedVerbandId = verbandId ? parseInt(verbandId, 10) : undefined;

    return this.scraperService.getFailures(
      parsedVerbandId !== undefined && !isNaN(parsedVerbandId)
        ? { verbandId: parsedVerbandId }
        : undefined
    );
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

  @Post('sync-delta/league/:liganr')
  @UseGuards(ScraperAuthGuard)
  async syncLeagueDelta(
    @Param('liganr', ParseIntPipe) liganr: number,
    @Query('rangeDays') rangeDays?: string
  ) {
    const parsedRangeDays = rangeDays ? parseInt(rangeDays, 10) : undefined;

    return this.scraperService.syncLeagueDelta(
      liganr,
      parsedRangeDays !== undefined && !isNaN(parsedRangeDays)
        ? { rangeDays: parsedRangeDays }
        : undefined
    );
  }

  @Post('sync-delta/verband/:verbandId')
  @UseGuards(ScraperAuthGuard)
  async syncVerbandDelta(
    @Param('verbandId', ParseIntPipe) verbandId: number,
    @Query('rangeDays') rangeDays?: string,
    @Query('concurrency') concurrency?: string
  ) {
    const parsedRangeDays = rangeDays ? parseInt(rangeDays, 10) : undefined;
    const parsedConcurrency = concurrency ? parseInt(concurrency, 10) : undefined;

    return this.scraperService.syncVerbandDelta(verbandId, {
      rangeDays:
        parsedRangeDays !== undefined && !isNaN(parsedRangeDays)
          ? parsedRangeDays
          : undefined,
      concurrency:
        parsedConcurrency !== undefined && !isNaN(parsedConcurrency)
          ? parsedConcurrency
          : undefined,
    });
  }

  @Post('retry-failed')
  @UseGuards(ScraperAuthGuard)
  async retryFailed(
    @Query('verbandId') queryVerbandId?: string,
    @Body() body?: { verbandId?: number }
  ) {
    const rawVerband =
      body?.verbandId ??
      (queryVerbandId ? parseInt(queryVerbandId, 10) : undefined);

    const parsedVerbandId =
      rawVerband !== undefined && !isNaN(rawVerband) ? rawVerband : undefined;

    return this.scraperService.retryFailed(
      parsedVerbandId !== undefined ? { verbandId: parsedVerbandId } : undefined
    );
  }

  @Post('geocode-missing')
  @UseGuards(ScraperAuthGuard)
  async geocodeMissing() {
    return this.scraperService.geocodeMissingVenues();
  }
}
