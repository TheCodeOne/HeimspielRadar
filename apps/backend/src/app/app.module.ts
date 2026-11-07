import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MatchesModule } from './matches/matches.module';
import { PushModule } from './push/push.module';
import { ScraperModule } from './scraper/scraper.module';
import { resolveFrontendDistPath } from './static-path.util';
import { CloudflareThrottlerGuard } from './throttler/cloudflare-throttler.guard';

const frontendDistPath = resolveFrontendDistPath();

const isFrontendDisabled =
  process.env.SERVE_FRONTEND === 'false' ||
  process.env.DISABLE_STATIC_SERVING === 'true';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    ...(isFrontendDisabled
      ? []
      : [
          ServeStaticModule.forRoot({
            rootPath: frontendDistPath,
            exclude: ['/api/{*path}'],
          }),
        ]),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 60,
      },
    ]),
    DatabaseModule,
    PushModule,
    ScraperModule,
    MatchesModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CloudflareThrottlerGuard,
    },
  ],
})
export class AppModule {}
