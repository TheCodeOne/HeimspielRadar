import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { LeaguesController } from './leagues.controller';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MatchesController, LeaguesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}

