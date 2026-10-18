import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MatchesModule } from './matches/matches.module';
import { ScraperModule } from './scraper/scraper.module';
import { resolveFrontendDistPath } from './static-path.util';

const frontendDistPath = resolveFrontendDistPath();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: frontendDistPath,
      exclude: ['/api/{*path}'],
    }),
    DatabaseModule,
    ScraperModule,
    MatchesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
