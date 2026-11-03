import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { matches, venues, venueSubmissions } from '../database/schema';
import { AdminApiGuard } from './admin-api.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
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
      sendSubmissionApprovedConfirmation: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };

    mockDb = {
      execute: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
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

  describe('submissions moderation (approve / reject)', () => {
    let updatedTables: Array<{ table: any; values: any }>;
    let mockSubmissionRow: any;

    beforeEach(() => {
      process.env['ADMIN_API_SECRET'] = 'top-secret-token';
      updatedTables = [];
      mockSubmissionRow = {
        id: 15,
        matchId: 101,
        venueId: 901,
        submitterName: 'Jonas',
        submitterRole: 'Hallensprecher',
        submittedData: {
          admissionFee: 'Eintritt frei',
          matchNotes: 'Spitzenspiel mit Hallensprecher',
          kioskDescription: 'Frische Waffeln & Kaffee',
          parkingNotes: 'Parkplatz hinter der Sporthalle',
        },
        status: 'pending',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        updatedAt: new Date('2026-11-01T10:00:00Z'),
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(async () =>
              mockSubmissionRow ? [mockSubmissionRow] : []
            ),
          }),
        }),
      });

      mockDb.update = jest.fn().mockImplementation((table: any) => ({
        set: jest.fn().mockImplementation((values: any) => {
          updatedTables.push({ table, values });

          return {
            where: jest.fn().mockImplementation(() => {
              const promise = Promise.resolve();

              const chain = {
                returning: jest.fn().mockResolvedValue([
                  {
                    ...mockSubmissionRow,
                    ...values,
                  },
                ]),
              };

              return Object.assign(promise, chain);
            }),
          };
        }),
      }));

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => cb(mockDb));
    });

    it('atomically updates match, venue, and submission status on approve and sends Telegram confirmation', async () => {
      const result = await controller.approveSubmission(15, 'top-secret-token');

      expect(result.status).toBe('approved');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(updatedTables).toHaveLength(3);

      const matchUpdate = updatedTables.find((u) => u.table === matches);
      expect(matchUpdate?.values).toEqual(
        expect.objectContaining({
          admissionFee: 'Eintritt frei',
          matchNotes: 'Spitzenspiel mit Hallensprecher',
        })
      );

      const venueUpdate = updatedTables.find((u) => u.table === venues);
      expect(venueUpdate?.values).toEqual(
        expect.objectContaining({
          kioskDescription: 'Frische Waffeln & Kaffee',
          parkingNotes: 'Parkplatz hinter der Sporthalle',
        })
      );

      const submissionUpdate = updatedTables.find((u) => u.table === venueSubmissions);
      expect(submissionUpdate?.values).toEqual(
        expect.objectContaining({
          status: 'approved',
        })
      );

      expect(mockTelegramNotifier.sendSubmissionApprovedConfirmation).toHaveBeenCalledWith(15);
    });

    it('supports GET approve endpoint and Bearer header authentication', async () => {
      const result = await controller.approveSubmissionGet(
        15,
        undefined,
        'Bearer top-secret-token'
      );

      expect(result.status).toBe('approved');
    });

    it('marks submission as rejected without updating match or venue on reject', async () => {
      const result = await controller.rejectSubmission(15, 'top-secret-token');

      expect(result.status).toBe('rejected');
      expect(updatedTables).toHaveLength(1);
      expect(updatedTables[0].table).toBe(venueSubmissions);
      expect(updatedTables[0].values).toEqual(
        expect.objectContaining({
          status: 'rejected',
        })
      );
      expect(
        mockTelegramNotifier.sendSubmissionApprovedConfirmation
      ).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when token is missing or invalid', async () => {
      await expect(controller.approveSubmission(15, 'wrong-token')).rejects.toThrow(
        UnauthorizedException
      );

      await expect(controller.rejectSubmission(15, undefined)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockSubmissionRow = null;

      await expect(
        controller.approveSubmission(999, 'top-secret-token')
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.rejectSubmission(999, 'top-secret-token')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
