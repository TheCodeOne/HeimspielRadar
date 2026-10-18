import { Controller, Get } from '@nestjs/common';
import { League } from '@sundayleague/shared-types';
import { MatchesService } from './matches.service';

@Controller('leagues')
export class LeaguesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  async getLeagues(): Promise<League[]> {
    return this.matchesService.findAllLeagues();
  }
}
