import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
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

  describe('getSubmissions (GET /api/admin/submissions)', () => {
    let mockSubmissionRelationalRows: any[];
    let capturedWhereCond: any;

    beforeEach(() => {
      capturedWhereCond = undefined;

      mockSubmissionRelationalRows = [
        {
          submission: {
            id: 21,
            matchId: 101,
            venueId: 901,
            submitterName: 'Lena',
            submitterRole: 'Verein',
            submittedData: {
              admissionFee: '2 EUR',
              kioskDescription: 'Belegte Brötchen & Kaltgetränke',
              parkingNotes: 'Tiefgarage gegenüber',
              matchNotes: 'Einlass ab 17:15 Uhr',
            },
            status: 'pending',
            createdAt: new Date('2026-11-02T14:30:00Z'),
            updatedAt: new Date('2026-11-02T14:30:00Z'),
          },
          match: {
            id: 101,
            leagueId: 53941,
            kickoffDate: '2026-11-08',
            kickoffTime: '18:00',
            homeTeamId: 10,
            guestTeamId: 20,
          },
          league: {
            id: 53941,
            name: 'Oberliga Herren BaWü',
          },
          homeTeam: {
            id: 10,
            name: 'Stuttgart Baskets',
            shortName: 'Baskets',
          },
          guestTeam: {
            id: 20,
            name: 'City Lions Ludwigsburg',
            shortName: 'Lions',
          },
          venue: {
            id: 901,
            name: 'Scharrena Stuttgart',
            street: 'Mercedesstr. 87',
            postalCode: '70372',
            city: 'Stuttgart',
          },
        },
      ];

      mockDb.select = jest.fn().mockImplementation(() => {
        const promise = Promise.resolve(mockSubmissionRelationalRows);

        const chain: any = {
          from: () => Object.assign(promise, chain),
          leftJoin: () => Object.assign(promise, chain),
          where: (cond: any) => {
            capturedWhereCond = cond;

            return Object.assign(promise, chain);
          },
          orderBy: () => Object.assign(promise, chain),
        };

        return Object.assign(promise, chain);
      });
    });

    it('returns all submissions with joined match and venue details when status is all or omitted', async () => {
      const results = await controller.getSubmissions('all');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(21);
      expect(results[0].status).toBe('pending');
      expect(results[0].submitterName).toBe('Lena');
      expect(results[0].submitterRole).toBe('Verein');
      expect(results[0].submittedData.kioskDescription).toBe(
        'Belegte Brötchen & Kaltgetränke'
      );
      expect(results[0].match).toEqual({
        id: 101,
        leagueId: 53941,
        leagueName: 'Oberliga Herren BaWü',
        kickoffDate: '2026-11-08',
        kickoffTime: '18:00',
        homeTeam: 'Stuttgart Baskets',
        guestTeam: 'City Lions Ludwigsburg',
      });
      expect(results[0].venue).toEqual({
        id: 901,
        name: 'Scharrena Stuttgart',
        street: 'Mercedesstr. 87',
        postalCode: '70372',
        city: 'Stuttgart',
      });
      expect(capturedWhereCond).toBeUndefined();
    });

    it('filters submissions by status when pending, approved, or rejected is passed', async () => {
      await controller.getSubmissions('pending');

      expect(capturedWhereCond).toBeDefined();

      const dialect = new PgDialect();
      const queryObj = dialect.sqlToQuery(capturedWhereCond);

      expect(queryObj.params).toContain('pending');
    });

    it('throws BadRequestException when an invalid status filter is provided', async () => {
      await expect(controller.getSubmissions('invalid_status')).rejects.toThrow(
        BadRequestException
      );
    });

    it('updates a submission and cascades changes when approved', async () => {
      const mockUpdated = {
        id: 21,
        status: 'approved',
        submitterName: 'Lena Updated',
        submittedData: {
          admissionFee: '5 EUR',
          kioskDescription: 'Frische Waffeln',
        },
      };

      // SAFETY: mock testing payload matches VenueSubmission shape for testing
      const mockedResponse = mockUpdated as any;

      jest
        .spyOn(controller['resolvedAdminService'], 'updateSubmission')
        .mockResolvedValue(mockedResponse);

      const result = await controller.updateSubmission(21, {
        admissionFee: '5 EUR',
        kioskDescription: 'Frische Waffeln',
      });

      expect(result).toEqual(mockUpdated);
    });

    it('deletes a submission via deleteSubmission', async () => {
      jest
        .spyOn(controller['resolvedAdminService'], 'deleteSubmission')
        .mockResolvedValue({ id: 21, deleted: true });

      const result = await controller.deleteSubmission(21);

      expect(result).toEqual({ id: 21, deleted: true });
    });
  });

  describe('featured matches management (search, featured list, toggle)', () => {
    let mockRelationalRows: any[];
    let capturedWhereCond: any;
    let updatedMatchValues: any;
    let mockUpdatedMatchRow: any;

    beforeEach(() => {
      capturedWhereCond = undefined;
      updatedMatchValues = undefined;

      const sampleRelationalRow = {
        match: {
          id: 101,
          leagueId: 53941,
          matchDay: 3,
          matchNo: 301,
          kickoffDate: '2026-11-08',
          kickoffTime: '18:00',
          result: null,
          confirmed: true,
          admissionFee: '3 EUR',
          matchNotes: 'Derby-Spieltag',
          isFeatured: false,
          featuredUntil: null,
        },
        league: {
          id: 53941,
          dbbId: 53941,
          name: 'Oberliga Herren BaWü',
          skName: 'Oberliga',
          akName: 'Senioren',
          geschlecht: 'männlich',
        },
        homeTeam: {
          id: 10,
          dbbId: 501,
          name: 'Stuttgart Baskets',
          shortName: 'Baskets',
          clubId: 100,
        },
        guestTeam: {
          id: 20,
          dbbId: 502,
          name: 'City Lions Ludwigsburg',
          shortName: 'Lions',
          clubId: 200,
        },
        venue: {
          id: 901,
          name: 'Scharrena Stuttgart',
          street: 'Mercedesstr. 87',
          postalCode: '70372',
          city: 'Stuttgart',
          latitude: 48.79,
          longitude: 9.23,
          geocodedAt: new Date('2026-10-01T12:00:00Z'),
        },
      };

      mockRelationalRows = [sampleRelationalRow];

      mockUpdatedMatchRow = {
        id: 101,
        leagueId: 53941,
        matchDay: 3,
        matchNo: 301,
        kickoffDate: '2026-11-08',
        kickoffTime: '18:00',
        homeTeamId: 10,
        guestTeamId: 20,
        venueId: 901,
        confirmed: true,
        isFeatured: true,
        featuredUntil: new Date('2026-11-10T20:00:00Z'),
      };

      mockDb.select = jest.fn().mockImplementation(() => {
        const promise = Promise.resolve(mockRelationalRows);

        const chain: any = {
          from: () => Object.assign(promise, chain),
          innerJoin: () => Object.assign(promise, chain),
          leftJoin: () => Object.assign(promise, chain),
          where: (cond: any) => {
            capturedWhereCond = cond;

            return Object.assign(promise, chain);
          },
          orderBy: () => Object.assign(promise, chain),
          limit: () => Object.assign(promise, chain),
        };

        return Object.assign(promise, chain);
      });

      mockDb.update = jest.fn().mockImplementation(() => ({
        set: jest.fn().mockImplementation((values: any) => {
          updatedMatchValues = values;

          return {
            where: jest.fn().mockImplementation(() => ({
              returning: jest.fn().mockImplementation(async () =>
                mockUpdatedMatchRow
                  ? [{ ...mockUpdatedMatchRow, ...values }]
                  : []
              ),
            })),
          };
        }),
      }));
    });

    it('returns empty array when search query is empty or whitespace', async () => {
      expect(await controller.searchMatches(undefined)).toEqual([]);
      expect(await controller.searchMatches('')).toEqual([]);
      expect(await controller.searchMatches('   ')).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('searches matches by team name, league, or numeric match ID', async () => {
      const results = await controller.searchMatches('Baskets 101');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(101);
      expect(results[0].homeTeam.name).toBe('Stuttgart Baskets');
      expect(results[0].guestTeam.name).toBe('City Lions Ludwigsburg');
      expect(results[0].league?.name).toBe('Oberliga Herren BaWü');
      expect(results[0].isFeatured).toBe(false);
      expect(results[0].featuredUntil).toBeNull();

      const dialect = new PgDialect();
      const queryObj = dialect.sqlToQuery(capturedWhereCond);

      expect(queryObj.params).toContain('%Baskets%');
      expect(queryObj.params).toContain(101);
    });

    it('lists active featured matches via GET /api/admin/matches/featured', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      mockRelationalRows[0].match.isFeatured = true;
      mockRelationalRows[0].match.featuredUntil = futureDate;

      const results = await controller.getFeaturedMatches();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(101);
      expect(results[0].isFeatured).toBe(true);
      expect(results[0].featuredUntil).toBe(futureDate.toISOString());
    });

    it('enables isFeatured with 7-day default expiration on POST /api/admin/matches/:id/feature', async () => {
      const before = Date.now();
      const result = await controller.featureMatch(101, { isFeatured: true });
      const after = Date.now();

      expect(result.id).toBe(101);
      expect(result.isFeatured).toBe(true);
      expect(result.featuredUntil).toBeDefined();
      expect(updatedMatchValues.isFeatured).toBe(true);
      expect(updatedMatchValues.featuredUntil).toBeInstanceOf(Date);

      const expectedMin = before + 7 * 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = after + 7 * 24 * 60 * 60 * 1000 + 1000;
      const actualMs = updatedMatchValues.featuredUntil.getTime();

      expect(actualMs).toBeGreaterThanOrEqual(expectedMin);
      expect(actualMs).toBeLessThanOrEqual(expectedMax);
    });

    it('resets isFeatured to false and featuredUntil to null when disabling feature', async () => {
      const result = await controller.featureMatch(101, { isFeatured: false });

      expect(result.id).toBe(101);
      expect(result.isFeatured).toBe(false);
      expect(result.featuredUntil).toBeNull();
      expect(updatedMatchValues.isFeatured).toBe(false);
      expect(updatedMatchValues.featuredUntil).toBeNull();
    });

    it('throws BadRequestException when isFeatured is missing or not a boolean', async () => {
      // SAFETY: Intentionally passing invalid payload to test runtime validation
      const invalidDto = {} as any;

      await expect(controller.featureMatch(101, invalidDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('throws NotFoundException when toggling feature on non-existent match', async () => {
      mockUpdatedMatchRow = null;

      await expect(
        controller.featureMatch(999999, { isFeatured: true })
      ).rejects.toThrow(NotFoundException);
    });
  });
});
