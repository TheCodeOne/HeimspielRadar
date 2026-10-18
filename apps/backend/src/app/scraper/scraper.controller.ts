import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
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
  async syncLeague(@Param('leagueId', ParseIntPipe) leagueId: number) {
    return this.scraperService.syncLeague(leagueId);
  }
}
