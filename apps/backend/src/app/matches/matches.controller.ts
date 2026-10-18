import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MatchesService } from './matches.service';

function parseStringArrayParam(value?: string | string[]): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const rawItems = Array.isArray(value) ? value : [value];

  const parsed = rawItems
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function parseNumberArrayParam(value?: string | string[]): number[] | undefined {
  const strings = parseStringArrayParam(value);

  if (!strings) {
    return undefined;
  }

  const numbers = strings
    .map((item) => parseInt(item, 10))
    .filter((num) => !Number.isNaN(num));

  return numbers.length > 0 ? numbers : undefined;
}

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async getMatches(
    @Query('date') date?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('leagueId') leagueId?: string,
    @Query('leagueIds') leagueIds?: string | string[],
    @Query('genders') genders?: string | string[],
    @Query('ageClasses') ageClasses?: string | string[],
    @Query('skillLevels') skillLevels?: string | string[],
    @Query('onlyUpcoming') onlyUpcoming?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.matchesService.findMatches({
      date,
      dateFrom,
      dateTo,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
      leagueId: leagueId ? parseInt(leagueId, 10) : undefined,
      leagueIds: parseNumberArrayParam(leagueIds),
      genders: parseStringArrayParam(genders),
      ageClasses: parseStringArrayParam(ageClasses),
      skillLevels: parseStringArrayParam(skillLevels),
      onlyUpcoming:
        onlyUpcoming === 'true' || onlyUpcoming === '1' ? true : undefined,
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

