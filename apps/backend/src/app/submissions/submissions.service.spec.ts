import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { matches, venues, venueSubmissions } from '../database/schema';
import {
  SubmissionsService,
  validateKioskSubmissionDto,
  verifyAdminToken,
} from './submissions.service';

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let mockDb: any;
  let mockTelegramNotifier: any;
  let updatedTables: Array<{ table: any; values: any }>;
  let insertedRows: Array<{ table: any; values: any }>;
  let deletedRows: Array<{ table: any }>;
  let mockSubmissionRow: any;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ENABLE_ADMIN_API: 'true',
      ADMIN_API_SECRET: 'top-secret-token',
    };
    updatedTables = [];
    insertedRows = [];
    deletedRows = [];

    mockSubmissionRow = {
      id: 15,
      matchId: 101,
      venueId: 901,
      submitterName: 'Jonas',
      submitterRole: 'Hallensprecher',
      scope: 'matchday',
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

    mockTelegramNotifier = {
      sendKioskSubmissionAlert: jest.fn().mockResolvedValue({ ok: true, messageId: 99 }),
      sendSubmissionApprovedConfirmation: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(async () =>
              mockSubmissionRow ? [mockSubmissionRow] : []
            ),
          }),
          leftJoin: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockImplementation(async () =>
            mockSubmissionRow ? [mockSubmissionRow] : []
          ),
        }),
      }),
      insert: jest.fn().mockImplementation((table: any) => ({
        values: jest.fn().mockImplementation((values: any) => {
          insertedRows.push({ table, values });

          return {
            returning: jest.fn().mockResolvedValue([
              {
                id: 1,
                ...values,
              },
            ]),
          };
        }),
      })),
      update: jest.fn().mockImplementation((table: any) => ({
        set: jest.fn().mockImplementation((values: any) => {
          updatedTables.push({ table, values });

          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([
                {
                  ...mockSubmissionRow,
                  ...values,
                },
              ]),
            }),
          };
        }),
      })),
      delete: jest.fn().mockImplementation((table: any) => ({
        where: jest.fn().mockImplementation(() => {
          deletedRows.push({ table });

          return Promise.resolve();
        }),
      })),
    };

    service = new SubmissionsService(mockDb, mockTelegramNotifier);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateKioskSubmissionDto', () => {
    it('validates and normalizes valid DTO', () => {
      const validated = validateKioskSubmissionDto({
        matchId: 101,
        admissionFee: '  3 EUR ',
        kioskDescription: '  Kaffee & Kuchen ',
        parkingNotes: ' P1 ',
        matchNotes: ' Derby ',
        submitterName: ' Anna ',
        submitterRole: ' Trainerin ',
        scope: 'match',
      });

      expect(validated).toEqual({
        matchId: 101,
        admissionFee: '3 EUR',
        kioskDescription: 'Kaffee & Kuchen',
        parkingNotes: 'P1',
        matchNotes: 'Derby',
        submitterName: 'Anna',
        submitterRole: 'Trainerin',
        scope: 'match',
      });
    });

    it('throws BadRequestException when no content field is provided', () => {
      expect(() =>
        validateKioskSubmissionDto({
          matchId: 101,
          submitterName: 'Anna',
          submitterRole: 'Fan',
        })
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when scope is invalid', () => {
      expect(() =>
        validateKioskSubmissionDto({
          kioskDescription: 'Kaffee',
          // SAFETY: testing invalid scope string at runtime
          scope: 'invalid-scope' as any,
        })
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException when fields exceed max length', () => {
      expect(() =>
        validateKioskSubmissionDto({
          admissionFee: 'x'.repeat(51),
        })
      ).toThrow(BadRequestException);

      expect(() =>
        validateKioskSubmissionDto({
          kioskDescription: 'x'.repeat(201),
        })
      ).toThrow(BadRequestException);
    });
  });

  describe('createSubmission', () => {
    it('creates a pending submission and dispatches Telegram alert', async () => {
      const mockMatchRow = {
        match: { id: 101, leagueId: 53941, venueId: 901 },
        league: { id: 53941, name: 'Bezirksliga Herren' },
        homeTeam: { id: 1, name: 'TSG Stuttgart' },
        guestTeam: { id: 2, name: 'MTV Ludwigsburg' },
        venue: { id: 901, name: 'Arena Stuttgart', city: 'Stuttgart' },
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockMatchRow]),
            }),
          }),
        }),
      });

      const result = await service.createSubmission({
        matchId: 101,
        admissionFee: 'Freier Eintritt',
        kioskDescription: 'Kaffee & Brezeln',
        parkingNotes: 'Parkplatz vor der Halle',
        submitterName: 'Lukas',
        submitterRole: 'Zuschauer',
        scope: 'matchday',
      });

      expect(result.id).toBe(1);
      expect(result.matchId).toBe(101);
      expect(result.venueId).toBe(901);
      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0].table).toBe(venueSubmissions);
      expect(mockTelegramNotifier.sendKioskSubmissionAlert).toHaveBeenCalledWith({
        submissionId: 1,
        homeTeam: 'TSG Stuttgart',
        guestTeam: 'MTV Ludwigsburg',
        leagueName: 'Bezirksliga Herren',
        venueName: 'Arena Stuttgart',
        city: 'Stuttgart',
        admissionFee: 'Freier Eintritt',
        kioskDescription: 'Kaffee & Brezeln',
        parkingNotes: 'Parkplatz vor der Halle',
        matchNotes: null,
        submitterName: 'Lukas',
        submitterRole: 'Zuschauer',
      });
    });

    it('throws BadRequestException when matchId is missing or non-integer', async () => {
      await expect(
        service.createSubmission({
          kioskDescription: 'Kaffee',
        })
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createSubmission({
          matchId: -5,
          kioskDescription: 'Kaffee',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when match is not found in database', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      await expect(
        service.createSubmission({
          matchId: 99999,
          kioskDescription: 'Kaffee',
        })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubmissions', () => {
    it('returns submissions mapped with match and venue details', async () => {
      const mockRelationalRows = [
        {
          submission: mockSubmissionRow,
          match: {
            id: 101,
            leagueId: 53941,
            kickoffDate: '2026-11-20',
            kickoffTime: '19:00',
          },
          league: { id: 53941, name: 'Bezirksliga Herren' },
          homeTeam: { id: 1, name: 'TSG Stuttgart' },
          guestTeam: { id: 2, name: 'MTV Ludwigsburg' },
          venue: { id: 901, name: 'Arena Stuttgart', city: 'Stuttgart' },
        },
      ];

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(mockRelationalRows),
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockRelationalRows),
          }),
        }),
      });

      const all = await service.getSubmissions('all');

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(15);
      expect(all[0].match?.homeTeam).toBe('TSG Stuttgart');
      expect(all[0].venue?.city).toBe('Stuttgart');
    });

    it('throws BadRequestException on invalid status filter', async () => {
      await expect(service.getSubmissions('invalid_status')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getSubmissionById', () => {
    it('returns single submission by ID', async () => {
      const mockRelationalRow = {
        submission: mockSubmissionRow,
        match: {
          id: 101,
          leagueId: 53941,
          kickoffDate: '2026-11-20',
          kickoffTime: '19:00',
        },
        league: { id: 53941, name: 'Bezirksliga Herren' },
        homeTeam: { id: 1, name: 'TSG Stuttgart' },
        guestTeam: { id: 2, name: 'MTV Ludwigsburg' },
        venue: { id: 901, name: 'Arena Stuttgart', city: 'Stuttgart' },
      };

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockRelationalRow]),
          }),
        }),
      });

      const sub = await service.getSubmissionById(15);

      expect(sub.id).toBe(15);
      expect(sub.match?.homeTeam).toBe('TSG Stuttgart');
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(service.getSubmissionById(9999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('approveSubmission', () => {
    it('approves submission with scope match and updates only match', async () => {
      mockSubmissionRow = {
        ...mockSubmissionRow,
        id: 16,
        scope: 'match',
        submittedData: {
          admissionFee: '4 EUR',
          kioskDescription: 'Gourmet Burger Special',
          parkingNotes: 'Parkhaus P2',
          matchNotes: 'Topspiel',
        },
      };

      const result = await service.approveSubmission(16);

      expect(result.status).toBe('approved');
      expect(updatedTables).toHaveLength(2);

      const matchUpdate = updatedTables.find((u) => u.table === matches);
      expect(matchUpdate?.values).toEqual(
        expect.objectContaining({
          admissionFee: '4 EUR',
          kioskDescription: 'Gourmet Burger Special',
          parkingNotes: 'Parkhaus P2',
          matchNotes: 'Topspiel',
          submitterName: 'Jonas',
          submitterRole: 'Hallensprecher',
        })
      );

      const venueUpdate = updatedTables.find((u) => u.table === venues);
      expect(venueUpdate).toBeUndefined();
      expect(
        mockTelegramNotifier.sendSubmissionApprovedConfirmation
      ).toHaveBeenCalledWith(16);
    });

    it('approves submission with scope matchday and cascades to venue and date', async () => {
      mockSubmissionRow = {
        ...mockSubmissionRow,
        id: 17,
        scope: 'matchday',
        submittedData: {
          admissionFee: 'Frei',
          kioskDescription: 'Ganztags Kiosk geöffnet',
          parkingNotes: 'Hallenparkplatz',
        },
      };

      const result = await service.approveSubmission(17);

      expect(result.status).toBe('approved');
      const venueUpdate = updatedTables.find((u) => u.table === venues);
      expect(venueUpdate?.values).toEqual(
        expect.objectContaining({
          kioskDescription: 'Ganztags Kiosk geöffnet',
          parkingNotes: 'Hallenparkplatz',
        })
      );
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockSubmissionRow = null;

      await expect(service.approveSubmission(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('rejectSubmission', () => {
    it('marks submission as rejected without modifying match or venue', async () => {
      const result = await service.rejectSubmission(15);

      expect(result.status).toBe('rejected');
      expect(updatedTables).toHaveLength(1);
      expect(updatedTables[0].table).toBe(venueSubmissions);
      expect(updatedTables[0].values).toEqual(
        expect.objectContaining({
          status: 'rejected',
        })
      );
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockSubmissionRow = null;

      await expect(service.rejectSubmission(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('updateSubmission', () => {
    it('updates submission data and cascades changes when approved', async () => {
      const result = await service.updateSubmission(15, {
        admissionFee: '5 EUR',
        kioskDescription: 'Vegane Hotdogs',
        status: 'approved',
        scope: 'match',
      });

      expect(result.status).toBe('approved');
      expect(updatedTables).toHaveLength(2);
      expect(
        mockTelegramNotifier.sendSubmissionApprovedConfirmation
      ).toHaveBeenCalledWith(15);
    });

    it('throws BadRequestException on invalid status or scope', async () => {
      await expect(
        // SAFETY: testing invalid status at runtime
        service.updateSubmission(15, { status: 'invalid' as any })
      ).rejects.toThrow(BadRequestException);

      await expect(
        // SAFETY: testing invalid scope at runtime
        service.updateSubmission(15, { scope: 'invalid' as any })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteSubmission', () => {
    it('deletes submission by ID', async () => {
      const result = await service.deleteSubmission(15);

      expect(result).toEqual({ id: 15, deleted: true });
      expect(deletedRows).toHaveLength(1);
      expect(deletedRows[0].table).toBe(venueSubmissions);
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockSubmissionRow = null;

      await expect(service.deleteSubmission(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('verifyAdminToken', () => {
    it('accepts correct token in query parameter', () => {
      expect(() =>
        verifyAdminToken('top-secret-token')
      ).not.toThrow();
    });

    it('accepts correct token in Bearer authorization header', () => {
      expect(() =>
        verifyAdminToken(undefined, 'Bearer top-secret-token')
      ).not.toThrow();
    });

    it('throws UnauthorizedException when token is wrong or missing', () => {
      expect(() =>
        verifyAdminToken('wrong-token')
      ).toThrow(UnauthorizedException);

      expect(() =>
        verifyAdminToken(undefined, 'Bearer wrong-token')
      ).toThrow(UnauthorizedException);

      expect(() =>
        verifyAdminToken(undefined, undefined)
      ).toThrow(UnauthorizedException);
    });
  });
});
