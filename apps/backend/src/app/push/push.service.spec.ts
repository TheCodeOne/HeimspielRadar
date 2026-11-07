import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../database/database.module';
import { PushService } from './push.service';
import * as webPushUtil from './web-push.util';

interface MockDatabase {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  query: {
    matches: {
      findFirst: jest.Mock;
    };
  };
}

interface MockConfigService {
  get: jest.Mock;
}

describe('PushService', () => {
  let service: PushService;

  let mockDb: MockDatabase;

  let mockConfig: MockConfigService;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      query: {
        matches: {
          findFirst: jest.fn(),
        },
      },
    };

    mockConfig = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        {
          provide: DRIZZLE_DB,
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initVapidKeys (3-tier fallback)', () => {
    it('Tier 1: loads VAPID keys from environment variables / ConfigService', async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') {
          return 'env-public-key';
        }

        if (key === 'VAPID_PRIVATE_KEY') {
          return 'env-private-key';
        }

        if (key === 'VAPID_SUBJECT') {
          return 'mailto:admin@heimspielradar.de';
        }

        return null;
      });

      await service.initVapidKeys();

      expect(service.getVapidPublicKey().publicKey).toBe('env-public-key');
      expect(service.getVapidPrivateKey()).toBe('env-private-key');
      expect(service.getVapidSubject()).toBe('mailto:admin@heimspielradar.de');
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('Tier 2: loads VAPID keys from system_settings DB table when not in env', async () => {
      mockConfig.get.mockReturnValue(null);

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            { key: 'vapid_public_key', value: 'db-public-key' },
            { key: 'vapid_private_key', value: 'db-private-key' },
          ]),
        }),
      });

      await service.initVapidKeys();

      expect(service.getVapidPublicKey().publicKey).toBe('db-public-key');
      expect(service.getVapidPrivateKey()).toBe('db-private-key');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Tier 3: generates and persists new VAPID keys to system_settings when not found in DB', async () => {
      mockConfig.get.mockReturnValue(null);

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([]),
        }),
      });

      const onConflictMock = jest.fn().mockResolvedValue({});

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: onConflictMock,
        }),
      });

      await service.initVapidKeys();

      expect(service.getVapidPublicKey().publicKey).toBeDefined();
      expect(service.getVapidPrivateKey()).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(onConflictMock).toHaveBeenCalled();
    });

    it('Fallback: generates ephemeral keys if database is unavailable', async () => {
      const emptyModule: TestingModule = await Test.createTestingModule({
        providers: [
          PushService,
          {
            provide: DRIZZLE_DB,
            useValue: null,
          },
          {
            provide: ConfigService,
            useValue: mockConfig,
          },
        ],
      }).compile();

      const ephemeralService = emptyModule.get<PushService>(PushService);
      mockConfig.get.mockReturnValue(null);

      await ephemeralService.initVapidKeys();

      expect(ephemeralService.getVapidPublicKey().publicKey).toBeDefined();
      expect(ephemeralService.getVapidPrivateKey()).toBeDefined();
    });
  });

  describe('registerReminder', () => {
    beforeEach(async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') {
          return 'test-pub';
        }

        if (key === 'VAPID_PRIVATE_KEY') {
          return 'test-priv';
        }

        return null;
      });

      await service.initVapidKeys();
    });

    it('throws BadRequestException for invalid matchId or leadTime', async () => {
      await expect(
        service.registerReminder({
          matchId: 0,
          leadTime: '1h',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.registerReminder({
          matchId: 10,
          // SAFETY: Testing invalid leadTime rejection at runtime
          leadTime: '' as '1h',
          subscription: {
            endpoint: 'https://push',
            keys: { p256dh: 'k', auth: 'a' },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the match does not exist in the database', async () => {
      mockDb.query.matches.findFirst.mockResolvedValue(null);

      await expect(
        service.registerReminder({
          matchId: 9999,
          leadTime: '2h',
          subscription: {
            endpoint: 'https://push',
            keys: { p256dh: 'k', auth: 'a' },
          },
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts subscription with match snapshot into push_reminders', async () => {
      mockDb.query.matches.findFirst.mockResolvedValue({
        id: 42,
        kickoffDate: '2026-11-08',
        kickoffTime: '15:00',
        venueId: 101,
      });

      const onConflictMock = jest.fn().mockResolvedValue({});

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: onConflictMock,
        }),
      });

      const res = await service.registerReminder({
        matchId: 42,
        leadTime: '1h',
        subscription: {
          endpoint: 'https://endpoint.example',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        },
      });

      expect(res).toEqual({
        success: true,
        matchId: 42,
        leadTime: '1h',
      });
      expect(mockDb.insert).toHaveBeenCalled();
      expect(onConflictMock).toHaveBeenCalled();
    });
  });

  describe('deleteReminder', () => {
    it('deletes reminder by matchId and endpoint', async () => {
      const whereMock = jest.fn().mockResolvedValue({});

      mockDb.delete.mockReturnValue({
        where: whereMock,
      });

      const res = await service.deleteReminder(42, 'https://endpoint');

      expect(res).toEqual({ success: true });
      expect(whereMock).toHaveBeenCalled();
    });
  });

  describe('checkDueReminders', () => {
    beforeEach(async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') {
          return 'test-pub';
        }

        if (key === 'VAPID_PRIVATE_KEY') {
          return 'test-priv';
        }

        return null;
      });

      await service.initVapidKeys();
    });

    it('prunes expired 404/410 subscriptions automatically', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 1,
              endpoint: 'https://push.expired',
              p256dh: 'k',
              auth: 'a',
              matchId: 10,
              leadTime: '1h',
              kickoffDate: '2026-11-08',
              kickoffTime: '15:00',
              reminderSentAt: null,
            },
          ]),
        }),
      });

      mockDb.query.matches.findFirst.mockResolvedValue({
        id: 10,
        homeTeam: { name: 'Alba' },
        guestTeam: { name: 'Bayern' },
        venue: { name: 'Max-Schmeling-Halle' },
      });

      jest.spyOn(webPushUtil, 'sendWebPushNotification').mockResolvedValue({
        success: false,
        statusCode: 410,
        expired: true,
      });

      const deleteWhere = jest.fn().mockResolvedValue({});

      mockDb.delete.mockReturnValue({ where: deleteWhere });

      const now = new Date('2026-11-08T13:30:00.000Z');
      const sent = await service.checkDueReminders(now);

      expect(sent).toBe(0);
      expect(deleteWhere).toHaveBeenCalled();
    });

    it('sends notification and sets reminderSentAt on success', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 5,
              endpoint: 'https://push.active',
              p256dh: 'k',
              auth: 'a',
              matchId: 20,
              leadTime: '2h',
              kickoffDate: '2026-11-08',
              kickoffTime: '15:00',
              reminderSentAt: null,
            },
          ]),
        }),
      });

      mockDb.query.matches.findFirst.mockResolvedValue({
        id: 20,
        homeTeam: { name: 'Neukölln' },
        guestTeam: { name: 'Moabit' },
        venue: { name: 'Sporthalle Neukölln' },
      });

      const sendSpy = jest.spyOn(webPushUtil, 'sendWebPushNotification').mockResolvedValue({
        success: true,
        statusCode: 201,
        expired: false,
      });

      const updateWhere = jest.fn().mockResolvedValue({});

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: updateWhere,
        }),
      });

      const now = new Date('2026-11-08T12:05:00.000Z');
      const sent = await service.checkDueReminders(now);

      expect(sent).toBe(1);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            title: expect.stringContaining('In 2 Stunden Anwurf'),
          }),
        }),
      );
      expect(updateWhere).toHaveBeenCalled();
    });
  });

  describe('handleMatchesUpdated', () => {
    beforeEach(async () => {
      mockConfig.get.mockImplementation((key: string) => {
        if (key === 'VAPID_PUBLIC_KEY') {
          return 'test-pub';
        }

        if (key === 'VAPID_PRIVATE_KEY') {
          return 'test-priv';
        }

        return null;
      });

      await service.initVapidKeys();
    });

    it('sends reschedule push and resets reminderSentAt if match is moved to the future', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([
            {
              id: 99,
              endpoint: 'https://push.reschedule',
              p256dh: 'k',
              auth: 'a',
              matchId: 77,
              leadTime: '1h',
              kickoffDate: '2026-11-08',
              kickoffTime: '14:00',
              venueId: 10,
              reminderSentAt: new Date('2026-11-08T12:00:00.000Z'),
            },
          ]),
        }),
      });

      mockDb.query.matches.findFirst.mockResolvedValue({
        id: 77,
        homeTeam: { name: 'Heim 77' },
        guestTeam: { name: 'Gast 77' },
        venue: { name: 'Neue Halle' },
      });

      const sendSpy = jest.spyOn(webPushUtil, 'sendWebPushNotification').mockResolvedValue({
        success: true,
        statusCode: 200,
        expired: false,
      });

      const setMock = jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({}),
      });

      mockDb.update.mockReturnValue({ set: setMock });

      const notified = await service.handleMatchesUpdated([
        {
          matchId: 77,
          kickoffDate: '2026-11-20',
          kickoffTime: '18:00',
          venueId: 12,
        },
      ]);

      expect(notified).toBe(1);
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            title: expect.stringContaining('Spieländerung'),
          }),
        }),
      );
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reminderSentAt: null,
          kickoffDate: '2026-11-20',
          kickoffTime: '18:00',
          venueId: 12,
        }),
      );
    });
  });
});
