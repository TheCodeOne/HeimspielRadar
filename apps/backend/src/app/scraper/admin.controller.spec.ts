import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminApiGuard } from './admin-api.guard';
import { AdminController } from './admin.controller';
import { ScraperService } from './scraper.service';
import { TelegramNotifierService } from './telegram-notifier.service';
import { DRIZZLE_DB } from '../database/database.module';

describe('AdminController', () => {
  let controller: AdminController;
  let mockScraperService: any;
  let mockTelegramNotifier: any;
  let mockDb: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, ENABLE_ADMIN_API: 'true' };

    mockScraperService = {
      getActiveSyncRun: jest.fn().mockResolvedValue(null),
      getRecentSyncRuns: jest.fn().mockResolvedValue([
        {
          id: 1,
          syncType: 'delta',
          target: 'verband:1',
          startedAt: new Date(),
          status: 'success',
        },
      ]),
      getFailures: jest.fn().mockResolvedValue([]),
      triggerAuditedSync: jest.fn().mockResolvedValue({
        success: true,
        runId: 42,
        status: 'running',
      }),
      retryFailed: jest.fn().mockResolvedValue({
        retriedCount: 1,
        resolvedCount: 1,
        stillFailingCount: 0,
        failures: [],
      }),
    };

    mockTelegramNotifier = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendTestMessage: jest.fn().mockResolvedValue({
        success: true,
        message: 'Test message sent',
      }),
    };

    mockDb = {
      execute: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: ScraperService, useValue: mockScraperService },
        { provide: TelegramNotifierService, useValue: mockTelegramNotifier },
        { provide: DRIZZLE_DB, useValue: mockDb },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('returns system status with uptime, memory, db and telegram status', async () => {
      const status = await controller.getStatus();

      expect(status.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(status.nodeVersion).toBe(process.version);
      expect(status.memory.heapUsedMb).toBeGreaterThan(0);
      expect(status.databaseConnected).toBe(true);
      expect(status.telegramConfigured).toBe(true);
      expect(status.lastSyncRun?.id).toBe(1);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('handles database error gracefully in status', async () => {
      mockDb.execute.mockRejectedValueOnce(new Error('Connection lost'));

      const status = await controller.getStatus();

      expect(status.databaseConnected).toBe(false);
    });
  });

  describe('getSyncRuns', () => {
    it('calls scraperService.getRecentSyncRuns with parsed limit', async () => {
      await controller.getSyncRuns('10');

      expect(mockScraperService.getRecentSyncRuns).toHaveBeenCalledWith(10);
    });

    it('defaults to limit 20 when limit query param is omitted or invalid', async () => {
      await controller.getSyncRuns(undefined);

      expect(mockScraperService.getRecentSyncRuns).toHaveBeenCalledWith(20);
    });
  });

  describe('getFailures', () => {
    it('delegates to scraperService.getFailures', async () => {
      await controller.getFailures();

      expect(mockScraperService.getFailures).toHaveBeenCalled();
    });
  });

  describe('triggerSync', () => {
    it('delegates to scraperService.triggerAuditedSync', async () => {
      const dto = { type: 'delta' as const, target: 'verband:1' };
      const res = await controller.triggerSync(dto);

      expect(mockScraperService.triggerAuditedSync).toHaveBeenCalledWith(dto);
      expect(res.runId).toBe(42);
      expect(res.status).toBe('running');
    });
  });

  describe('retryFailures', () => {
    it('delegates to scraperService.retryFailed', async () => {
      const res = await controller.retryFailures();

      expect(mockScraperService.retryFailed).toHaveBeenCalled();
      expect(res.resolvedCount).toBe(1);
    });
  });

  describe('testTelegram', () => {
    it('delegates to telegramNotifier.sendTestMessage', async () => {
      const res = await controller.testTelegram();

      expect(mockTelegramNotifier.sendTestMessage).toHaveBeenCalled();
      expect(res.success).toBe(true);
    });
  });

  describe('AdminApiGuard', () => {
    let guard: AdminApiGuard;
    // SAFETY: ExecutionContext is unused by AdminApiGuard
    const mockContext = {} as any;

    beforeEach(() => {
      guard = new AdminApiGuard();
    });

    it('allows request when ENABLE_ADMIN_API is true', () => {
      process.env['ENABLE_ADMIN_API'] = 'true';
      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('throws NotFoundException when ENABLE_ADMIN_API is false or undefined', () => {
      delete process.env['ENABLE_ADMIN_API'];
      expect(() => guard.canActivate(mockContext)).toThrow(NotFoundException);

      process.env['ENABLE_ADMIN_API'] = 'false';
      expect(() => guard.canActivate(mockContext)).toThrow(NotFoundException);
    });
  });
});
