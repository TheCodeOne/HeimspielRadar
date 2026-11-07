import type { Match } from '@sundayleague/shared-types';
import {
  deletePushReminderFromBackend,
  fetchVapidPublicKey,
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  scheduleWebPushReminder,
  subscribeToPushManager,
  syncPushReminderWithBackend,
  unsubscribeWebPushReminder,
  urlBase64ToUint8Array,
} from './push-notification';
import { getReminders } from './reminder-storage';

class MockStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

interface MockPushGlobal {
  window?: any;
  Notification?: any;
  navigator?: any;
  CustomEvent?: any;
}

// SAFETY: Extending globalThis for Node test environment
const testGlobal = globalThis as MockPushGlobal;

type MockResponseBody = Record<string, boolean | number | string | null> | string | null;

function mockFetchResponse(payload: MockResponseBody, ok = true): Response {
  const mockRes: Partial<Response> = {
    ok,
    json: async () => payload,
    text: async () => String(payload),
  };

  // SAFETY: Partial mock of Response for fetch tests
  return mockRes as Response;
}

function mockPushSubscription(endpoint = 'https://push'): PushSubscription {
  const mockSub: Partial<PushSubscription> = {
    endpoint,
    toJSON: () => ({ endpoint }),
  };

  // SAFETY: Partial mock of PushSubscription for tests
  return mockSub as PushSubscription;
}

describe('push-notification', () => {
  let mockStorage: MockStorage;

  beforeAll(() => {
    mockStorage = new MockStorage();

    testGlobal.window = {
      localStorage: mockStorage,
      atob: (str: string) => Buffer.from(str, 'base64').toString('binary'),
      dispatchEvent: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      navigator: {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: jest.fn().mockResolvedValue(null),
              subscribe: jest.fn().mockResolvedValue({
                endpoint: 'https://push',
                toJSON: () => ({ endpoint: 'https://push' }),
              }),
            },
          }),
        },
      },
      Notification: {
        permission: 'default',
        requestPermission: jest.fn().mockResolvedValue('granted'),
      },
    };

    testGlobal.navigator = testGlobal.window.navigator;
    testGlobal.Notification = testGlobal.window.Notification;
    testGlobal.CustomEvent = class {
      constructor(public type: string) {}
    };
  });

  beforeEach(() => {
    mockStorage.clear();
    jest.restoreAllMocks();
  });

  describe('urlBase64ToUint8Array', () => {
    it('converts base64url string to Uint8Array', () => {
      const base64Url = 'AQIDBA';
      const arr = urlBase64ToUint8Array(base64Url);

      expect(arr).toBeInstanceOf(Uint8Array);
      expect(Array.from(arr)).toEqual([1, 2, 3, 4]);
    });
  });

  describe('permissions and feature detection', () => {
    it('reports whether notifications are supported', () => {
      expect(isNotificationSupported()).toBe(true);

      const savedNotif = testGlobal.window.Notification;

      delete testGlobal.window.Notification;

      expect(isNotificationSupported()).toBe(false);

      testGlobal.window.Notification = savedNotif;
    });

    it('returns permission status from Notification.permission', () => {
      testGlobal.window.Notification = {
        permission: 'granted',
      };

      expect(getNotificationPermission()).toBe('granted');
    });

    it('requests notification permission via requestPermission', async () => {
      const mockRequest = jest.fn().mockResolvedValue('granted');

      testGlobal.window.Notification = {
        permission: 'default',
        requestPermission: mockRequest,
      };

      const result = await requestNotificationPermission();

      expect(result).toBe('granted');
      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('fetchVapidPublicKey', () => {
    it('fetches public key from /api/push/vapid-public-key', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse({ publicKey: 'mock-vapid-public-key' }));

      const key = await fetchVapidPublicKey();

      expect(key).toBe('mock-vapid-public-key');
      expect(global.fetch).toHaveBeenCalledWith('/api/push/vapid-public-key');
    });

    it('returns null when endpoint returns an error or fetch fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchResponse(null, false));

      const key = await fetchVapidPublicKey();

      expect(key).toBeNull();
    });
  });

  describe('subscribeToPushManager', () => {
    it('subscribes using registration.pushManager', async () => {
      const mockSub = { endpoint: 'https://push.example' };
      const mockSubscribe = jest.fn().mockResolvedValue(mockSub);
      const mockGetSubscription = jest.fn().mockResolvedValue(null);

      testGlobal.window.navigator = {
        serviceWorker: {
          ready: Promise.resolve({
            pushManager: {
              getSubscription: mockGetSubscription,
              subscribe: mockSubscribe,
            },
          }),
        },
      };
      testGlobal.navigator = testGlobal.window.navigator;
      testGlobal.window.PushManager = function () {};

      const sub = await subscribeToPushManager('AQIDBA');

      expect(sub).toBe(mockSub);
      expect(mockSubscribe).toHaveBeenCalledWith(
        expect.objectContaining({ userVisibleOnly: true }),
      );
    });
  });

  describe('syncPushReminderWithBackend & deletePushReminderFromBackend', () => {
    it('POSTs subscription payload to /api/push/reminders', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({ success: true }));

      const sub = mockPushSubscription('https://push');
      const success = await syncPushReminderWithBackend(10, '2h', sub);

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/push/reminders',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('DELETEs reminder from /api/push/reminders/:matchId', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({ success: true }));

      const success = await deletePushReminderFromBackend(10, 'https://push-ep');

      expect(success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/push/reminders/10?endpoint=https%3A%2F%2Fpush-ep',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('scheduleWebPushReminder', () => {
    const mockMatch: Match = {
      id: 55,
      leagueId: 10,
      matchDay: 3,
      homeTeam: { id: 1, dbbId: 101, name: 'BC Lions Moabit' },
      guestTeam: { id: 2, dbbId: 102, name: 'TuS Neukölln' },
      kickoffDate: '2026-11-15',
      kickoffTime: '16:00',
      isVenueVerified: true,
      confirmed: true,
      isFeatured: false,
    };

    it('saves locally even when notifications are unsupported', async () => {
      const savedNotif = testGlobal.window.Notification;

      delete testGlobal.window.Notification;

      const res = await scheduleWebPushReminder(mockMatch, '1h');

      expect(res.success).toBe(true);
      expect(res.permission).toBe('unsupported');
      expect(getReminders()).toHaveLength(1);
      expect(getReminders()[0].matchId).toBe(55);

      testGlobal.window.Notification = savedNotif;
    });

    it('returns denied result if user blocks notifications', async () => {
      testGlobal.window.Notification = {
        permission: 'denied',
      };

      const res = await scheduleWebPushReminder(mockMatch, '2h');

      expect(res.success).toBe(false);
      expect(res.permission).toBe('denied');
      expect(getReminders()).toHaveLength(1);
    });

    it('triggers confirmation notification and registers with backend on permission granted', async () => {
      testGlobal.window.Notification = function () {
        return {};
      };

      testGlobal.window.Notification.permission = 'granted';

      global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url === '/api/push/vapid-public-key') {
          return Promise.resolve(mockFetchResponse({ publicKey: 'mock-key' }));
        }

        if (url === '/api/push/reminders') {
          return Promise.resolve(mockFetchResponse({ ok: true }));
        }

        return Promise.resolve(mockFetchResponse(null, false));
      });

      const res = await scheduleWebPushReminder(mockMatch, '1d');

      expect(res.success).toBe(true);
      expect(res.permission).toBe('granted');
      expect(res.message).toContain('Web-Push');
    });
  });

  describe('unsubscribeWebPushReminder', () => {
    it('removes local storage reminder and calls backend DELETE', async () => {
      global.fetch = jest.fn().mockResolvedValue(mockFetchResponse({ success: true }));

      await unsubscribeWebPushReminder(99);

      expect(getReminders().find((r) => r.matchId === 99)).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/push/reminders/99',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
