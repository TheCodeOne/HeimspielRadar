import {
  KIOSK_QUEUE_STORAGE_KEY,
  KIOSK_QUEUE_SYNCED_EVENT,
  KIOSK_QUEUE_UPDATED_EVENT,
  clearQueuedSubmissions,
  enqueueKioskSubmission,
  getQueuedSubmissions,
  hasPendingKioskSubmission,
  initKioskAutoSync,
  parseQueuedSubmission,
  removeQueuedSubmission,
  syncPendingKioskSubmissions,
  _resetQueueForTesting,
} from './kiosk-submission-queue';

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

interface GlobalWithMocks {
  window?: unknown;
  document?: unknown;
  navigator?: unknown;
  fetch?: unknown;
  CustomEvent?: unknown;
}

// SAFETY: Test runner global object extended for Node test environment
const testGlobal = globalThis as GlobalWithMocks;

describe('kiosk-submission-queue', () => {
  let mockStorage: MockStorage;
  let dispatchEventMock: jest.Mock;
  let windowListeners: Record<string, EventListener[]>;
  let documentListeners: Record<string, EventListener[]>;

  beforeEach(() => {
    mockStorage = new MockStorage();
    dispatchEventMock = jest.fn();
    windowListeners = {};
    documentListeners = {};

    _resetQueueForTesting();

    testGlobal.window = {
      localStorage: mockStorage,
      dispatchEvent: dispatchEventMock,
      addEventListener: jest.fn((event: string, cb: EventListener) => {
        if (!windowListeners[event]) {
          windowListeners[event] = [];
        }

        windowListeners[event].push(cb);
      }),
      removeEventListener: jest.fn((event: string, cb: EventListener) => {
        if (windowListeners[event]) {
          windowListeners[event] = windowListeners[event].filter((item) => item !== cb);
        }
      }),
    };

    testGlobal.document = {
      visibilityState: 'visible',
      addEventListener: jest.fn((event: string, cb: EventListener) => {
        if (!documentListeners[event]) {
          documentListeners[event] = [];
        }

        documentListeners[event].push(cb);
      }),
      removeEventListener: jest.fn((event: string, cb: EventListener) => {
        if (documentListeners[event]) {
          documentListeners[event] = documentListeners[event].filter((item) => item !== cb);
        }
      }),
    };

    testGlobal.navigator = {
      onLine: true,
    };

    testGlobal.CustomEvent = class {
      constructor(
        public type: string,
        public init?: { detail?: unknown },
      ) {}

      get detail() {
        return this.init?.detail;
      }
    };
  });

  describe('parseQueuedSubmission', () => {
    it('returns null for null, undefined or empty input', () => {
      expect(parseQueuedSubmission(null)).toBeNull();
      expect(parseQueuedSubmission(undefined)).toBeNull();
    });

    it('returns null if matchId is not a positive number', () => {
      expect(parseQueuedSubmission({ matchId: 0, matchTitle: 'Team A vs Team B' })).toBeNull();
      expect(parseQueuedSubmission({ matchId: -5, matchTitle: 'Team A vs Team B' })).toBeNull();
      expect(parseQueuedSubmission({ matchId: NaN, matchTitle: 'Team A vs Team B' })).toBeNull();
    });

    it('returns null if matchTitle is empty', () => {
      expect(
        parseQueuedSubmission({
          matchId: 42,
          matchTitle: '',
          payload: { scope: 'matchday' },
        }),
      ).toBeNull();
    });

    it('returns null if payload is missing', () => {
      expect(
        parseQueuedSubmission({
          matchId: 42,
          matchTitle: 'Team A vs Team B',
        }),
      ).toBeNull();
    });

    it('correctly normalizes valid queued submission', () => {
      const parsed = parseQueuedSubmission({
        matchId: 101,
        matchTitle: 'BC Lions vs SV Baskets',
        venueName: 'Halle West',
        payload: {
          admissionFee: '3,00 €',
          kioskDescription: 'Kaffee und Kuchen',
          parkingNotes: 'Parkplatz P2',
          scope: 'matchday',
        },
        retryCount: 2,
      });

      expect(parsed).toEqual({
        matchId: 101,
        matchTitle: 'BC Lions vs SV Baskets',
        venueName: 'Halle West',
        payload: {
          scope: 'matchday',
          admissionFee: '3,00 €',
          kioskDescription: 'Kaffee und Kuchen',
          parkingNotes: 'Parkplatz P2',
          matchNotes: undefined,
          submitterName: undefined,
          submitterRole: undefined,
        },
        queuedAt: expect.any(String),
        retryCount: 2,
      });
    });
  });

  describe('CRUD operations & deduplication', () => {
    it('enqueues a submission into localStorage and dispatches update event', () => {
      enqueueKioskSubmission({
        matchId: 42,
        matchTitle: 'FC Bayern vs ALBA Berlin',
        venueName: 'Audi Dome',
        payload: {
          admissionFee: '5,00 €',
          scope: 'matchday',
        },
      });

      const queue = getQueuedSubmissions();

      expect(queue).toHaveLength(1);
      expect(queue[0].matchId).toBe(42);
      expect(hasPendingKioskSubmission(42)).toBe(true);
      expect(hasPendingKioskSubmission(99)).toBe(false);

      const raw = mockStorage.getItem(KIOSK_QUEUE_STORAGE_KEY);

      expect(raw).toBeTruthy();
      expect(dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: KIOSK_QUEUE_UPDATED_EVENT }),
      );
    });

    it('updates existing queue entry when same matchId is enqueued again (deduplication)', () => {
      enqueueKioskSubmission({
        matchId: 42,
        matchTitle: 'FC Bayern vs ALBA Berlin',
        venueName: 'Audi Dome',
        payload: {
          admissionFee: '5,00 €',
          scope: 'matchday',
        },
      });

      enqueueKioskSubmission({
        matchId: 42,
        matchTitle: 'FC Bayern vs ALBA Berlin',
        venueName: 'Audi Dome',
        payload: {
          admissionFee: 'Freier Eintritt',
          kioskDescription: 'Brezeln und Cola',
          scope: 'matchday',
        },
      });

      const queue = getQueuedSubmissions();

      expect(queue).toHaveLength(1);
      expect(queue[0].payload.admissionFee).toBe('Freier Eintritt');
      expect(queue[0].payload.kioskDescription).toBe('Brezeln und Cola');
    });

    it('removes a queued submission by matchId', () => {
      enqueueKioskSubmission({
        matchId: 1,
        matchTitle: 'Match 1',
        payload: { scope: 'matchday' },
      });
      enqueueKioskSubmission({
        matchId: 2,
        matchTitle: 'Match 2',
        payload: { scope: 'matchday' },
      });

      expect(getQueuedSubmissions()).toHaveLength(2);

      removeQueuedSubmission(1);

      const queue = getQueuedSubmissions();

      expect(queue).toHaveLength(1);
      expect(queue[0].matchId).toBe(2);
      expect(hasPendingKioskSubmission(1)).toBe(false);
      expect(hasPendingKioskSubmission(2)).toBe(true);
    });

    it('clears all queued submissions', () => {
      enqueueKioskSubmission({
        matchId: 1,
        matchTitle: 'Match 1',
        payload: { scope: 'matchday' },
      });

      clearQueuedSubmissions();

      expect(getQueuedSubmissions()).toHaveLength(0);
      expect(mockStorage.getItem(KIOSK_QUEUE_STORAGE_KEY)).toBe('[]');
    });
  });

  describe('syncPendingKioskSubmissions', () => {
    it('does not attempt sync when offline', async () => {
      // SAFETY: Navigator mock assignment for offline state
      (testGlobal.navigator as { onLine: boolean }).onLine = false;

      enqueueKioskSubmission({
        matchId: 42,
        matchTitle: 'Match 42',
        payload: { scope: 'matchday' },
      });

      const fetchMock = jest.fn();

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(getQueuedSubmissions()).toHaveLength(1);
    });

    it('returns empty result when queue is empty', async () => {
      const fetchMock = jest.fn();

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sequentially syncs queued submissions and removes successful ones', async () => {
      enqueueKioskSubmission({
        matchId: 10,
        matchTitle: 'Match 10',
        payload: { admissionFee: '2 €', scope: 'matchday' },
      });
      enqueueKioskSubmission({
        matchId: 20,
        matchTitle: 'Match 20',
        payload: { kioskDescription: 'Kaffee', scope: 'matchday' },
      });

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.syncedMatchIds).toEqual([10, 20]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(getQueuedSubmissions()).toHaveLength(0);

      expect(dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: KIOSK_QUEUE_SYNCED_EVENT,
          detail: { syncedCount: 2, syncedMatchIds: [10, 20] },
        }),
      );
    });

    it('discards unfixable 400 Bad Request submissions from queue', async () => {
      enqueueKioskSubmission({
        matchId: 11,
        matchTitle: 'Match 11 (Bad)',
        payload: { scope: 'matchday' },
      });
      enqueueKioskSubmission({
        matchId: 12,
        matchTitle: 'Match 12 (Good)',
        payload: { admissionFee: '3 €', scope: 'matchday' },
      });

      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
        });

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.syncedMatchIds).toEqual([12]);
      expect(getQueuedSubmissions()).toHaveLength(0);
    });

    it('retains submission and increments retryCount on 500 error, halting batch', async () => {
      enqueueKioskSubmission({
        matchId: 50,
        matchTitle: 'Match 50',
        payload: { scope: 'matchday' },
      });
      enqueueKioskSubmission({
        matchId: 51,
        matchTitle: 'Match 51',
        payload: { scope: 'matchday' },
      });

      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const queue = getQueuedSubmissions();

      expect(queue).toHaveLength(2);
      expect(queue[0].matchId).toBe(50);
      expect(queue[0].retryCount).toBe(1);
    });

    it('retains submission on network exception, halting batch', async () => {
      enqueueKioskSubmission({
        matchId: 60,
        matchTitle: 'Match 60',
        payload: { scope: 'matchday' },
      });

      const fetchMock = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

      testGlobal.fetch = fetchMock;

      const result = await syncPendingKioskSubmissions();

      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(1);

      const queue = getQueuedSubmissions();

      expect(queue).toHaveLength(1);
      expect(queue[0].retryCount).toBe(1);
    });
  });

  describe('initKioskAutoSync', () => {
    it('registers event listeners and triggers sync on online event', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      testGlobal.fetch = fetchMock;

      enqueueKioskSubmission({
        matchId: 77,
        matchTitle: 'Match 77',
        payload: { scope: 'matchday' },
      });

      const onSynced = jest.fn();
      const cleanup = initKioskAutoSync(onSynced);

      expect(windowListeners['online']).toBeDefined();
      expect(documentListeners['visibilitychange']).toBeDefined();

      // Trigger online event callback
      if (windowListeners['online'] && windowListeners['online'].length > 0) {
        windowListeners['online'][0](new Event('online'));
      }

      await Promise.resolve();
      await Promise.resolve();

      cleanup();

      expect(windowListeners['online']?.length ?? 0).toBe(0);
    });
  });
});
