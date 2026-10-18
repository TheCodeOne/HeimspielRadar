import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async getMatches(
    @Query('date') date?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('leagueId') leagueId?: string
  ) {
    return this.matchesService.findMatches({
      date,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      leagueId: leagueId ? parseInt(leagueId, 10) : undefined,
    });
  }

  @Get(':id')
  async getMatchById(@Param('id', ParseIntPipe) id: number) {
    const match = await this.matchesService.findById(id);

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match;
  }
}
