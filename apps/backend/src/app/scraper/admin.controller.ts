import {
  Body,
  Controller,
  Get,
  Inject,
  Optional,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  AdminStatusResponse,
  SyncRun,
  SyncTriggerDto,
} from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { syncRuns } from '../database/schema';
import { AdminApiGuard } from './admin-api.guard';
import { ScraperService } from './scraper.service';
import { TelegramNotifierService } from './telegram-notifier.service';

function toSyncRunDto(row: typeof syncRuns.$inferSelect | null): SyncRun | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    syncType: row.syncType,
    target: row.target,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    durationMs: row.durationMs,
    totalLeagues: row.totalLeagues,
    successfulLeagues: row.successfulLeagues,
    syncedMatches: row.syncedMatches,
    geocodedVenues: row.geocodedVenues,
    failuresCount: row.failuresCount,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}

@Controller('admin')
@UseGuards(AdminApiGuard)
export class AdminController {
  constructor(
    private readonly scraperService: ScraperService,
    private readonly telegramNotifier: TelegramNotifierService,
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null
  ) {}

  @Get('status')
  async getStatus(): Promise<AdminStatusResponse> {
    const mem = process.memoryUsage();
    let databaseConnected = false;

    if (this.db) {
      try {
        await this.db.execute(sql`SELECT 1`);
        databaseConnected = true;
      } catch {
        databaseConnected = false;
      }
    }

    const activeSyncRunRaw = await this.scraperService.getActiveSyncRun();
    const recentRunsRaw = await this.scraperService.getRecentSyncRuns(1);

    const activeSyncRun = toSyncRunDto(activeSyncRunRaw);
    const lastSyncRun = toSyncRunDto(recentRunsRaw[0] ?? null);

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: {
        heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      databaseConnected,
      telegramConfigured: this.telegramNotifier.isConfigured(),
      activeSyncRun,
      lastSyncRun,
    };
  }

  @Get('sync-runs')
  async getSyncRuns(@Query('limit') limitQuery?: string) {
    const limit = limitQuery ? parseInt(limitQuery, 10) : 20;

    return this.scraperService.getRecentSyncRuns(isNaN(limit) ? 20 : limit);
  }

  @Get('failures')
  async getFailures() {
    return this.scraperService.getFailures();
  }

  @Post('sync/trigger')
  async triggerSync(@Body() dto: SyncTriggerDto) {
    return this.scraperService.triggerAuditedSync(dto);
  }

  @Post('failures/retry')
  async retryFailures() {
    return this.scraperService.retryFailed();
  }

  @Post('telegram/test')
  async testTelegram() {
    return this.telegramNotifier.sendTestMessage();
  }
}
