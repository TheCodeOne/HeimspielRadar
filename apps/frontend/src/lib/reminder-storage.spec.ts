import {
  clearAllReminders,
  getLeadTimeLabel,
  getLeadTimeMinutes,
  getReminder,
  getReminders,
  hasReminder,
  parseGameReminder,
  pruneExpiredReminders,
  REMINDER_STORAGE_KEY,
  REMINDERS_UPDATED_EVENT,
  removeReminder,
  saveReminder,
  syncAppBadgeWithReminders,
  type GameReminder,
} from './reminder-storage';

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
  navigator?: unknown;
  CustomEvent?: unknown;
}

// SAFETY: Test runner global object extended for Node test environment
const testGlobal = globalThis as GlobalWithMocks;

describe('reminder-storage', () => {
  let mockStorage: MockStorage;
  let dispatchEventMock: jest.Mock;
  let setAppBadgeMock: jest.Mock;
  let clearAppBadgeMock: jest.Mock;

  beforeAll(() => {
    mockStorage = new MockStorage();
    dispatchEventMock = jest.fn();
    setAppBadgeMock = jest.fn().mockResolvedValue(undefined);
    clearAppBadgeMock = jest.fn().mockResolvedValue(undefined);

    testGlobal.window = {
      localStorage: mockStorage,
      dispatchEvent: dispatchEventMock,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    testGlobal.navigator = {
      setAppBadge: setAppBadgeMock,
      clearAppBadge: clearAppBadgeMock,
    };

    testGlobal.CustomEvent = class {
      constructor(public type: string) {}
    };
  });

  afterAll(() => {
    delete testGlobal.window;
    delete testGlobal.navigator;
    delete testGlobal.CustomEvent;
  });

  beforeEach(() => {
    mockStorage.clear();
    dispatchEventMock.mockClear();
    setAppBadgeMock.mockClear();
    clearAppBadgeMock.mockClear();
  });

  describe('lead time helpers', () => {
    it('returns correct minutes for each lead time', () => {
      expect(getLeadTimeMinutes('1h')).toBe(60);
      expect(getLeadTimeMinutes('2h')).toBe(120);
      expect(getLeadTimeMinutes('1d')).toBe(1440);
    });

    it('returns correct labels for each lead time', () => {
      expect(getLeadTimeLabel('1h')).toBe('1 Stunde vorher');
      expect(getLeadTimeLabel('2h')).toBe('2 Stunden vorher');
      expect(getLeadTimeLabel('1d')).toBe('1 Tag vorher');
    });
  });

  describe('parseGameReminder', () => {
    it('returns null for null, undefined or empty input', () => {
      expect(parseGameReminder(null)).toBeNull();
      expect(parseGameReminder(undefined)).toBeNull();
      expect(parseGameReminder({})).toBeNull();
    });

    it('returns null if matchId is not a positive number', () => {
      expect(parseGameReminder({ matchId: -5 })).toBeNull();
      expect(parseGameReminder({ matchId: 0 })).toBeNull();
      expect(parseGameReminder({ matchId: NaN })).toBeNull();
    });

    it('correctly normalizes valid reminder input', () => {
      const parsed = parseGameReminder({
        matchId: 101,
        matchTitle: 'TSG vs SV 03',
        homeTeamName: 'TSG Reutlingen',
        guestTeamName: 'SV 03 Tigers',
        leadTime: '1h',
        kickoffDate: '2026-11-08',
        kickoffTime: '17:30',
      });

      expect(parsed).toEqual(
        expect.objectContaining({
          matchId: 101,
          matchTitle: 'TSG vs SV 03',
          homeTeamName: 'TSG Reutlingen',
          guestTeamName: 'SV 03 Tigers',
          leadTime: '1h',
          kickoffDate: '2026-11-08',
          kickoffTime: '17:30',
        }),
      );
    });

    it('defaults leadTime to 2h if invalid option given', () => {
      // SAFETY: JSON parse tests runtime robustness against arbitrary input
      const invalidData = JSON.parse('{"matchId": 202, "leadTime": "invalid"}') as Partial<GameReminder>;
      const parsed = parseGameReminder(invalidData);

      expect(parsed?.leadTime).toBe('2h');
    });
  });

  describe('CRUD operations & events', () => {
    const sampleReminder: GameReminder = {
      matchId: 42,
      matchTitle: 'Team A vs Team B',
      homeTeamName: 'Team A',
      guestTeamName: 'Team B',
      leadTime: '2h',
      kickoffDate: '2026-12-01',
      kickoffTime: '19:00',
      createdAt: '2026-11-05T20:00:00.000Z',
    };

    it('saves a reminder to localStorage and dispatches event', () => {
      saveReminder(sampleReminder);

      const reminders = getReminders();

      expect(reminders).toHaveLength(1);
      expect(reminders[0].matchId).toBe(42);
      expect(hasReminder(42)).toBe(true);
      expect(getReminder(42)).toEqual(sampleReminder);

      expect(dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: REMINDERS_UPDATED_EVENT }),
      );
    });

    it('updates an existing reminder if saved again', () => {
      saveReminder(sampleReminder);

      const updated: GameReminder = {
        ...sampleReminder,
        leadTime: '1d',
      };

      saveReminder(updated);

      const reminders = getReminders();

      expect(reminders).toHaveLength(1);
      expect(reminders[0].leadTime).toBe('1d');
    });

    it('removes a reminder by matchId and dispatches event', () => {
      saveReminder(sampleReminder);
      expect(hasReminder(42)).toBe(true);

      removeReminder(42);

      expect(hasReminder(42)).toBe(false);
      expect(getReminders()).toHaveLength(0);
      expect(dispatchEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: REMINDERS_UPDATED_EVENT }),
      );
    });

    it('clears all reminders', () => {
      saveReminder(sampleReminder);
      saveReminder({ ...sampleReminder, matchId: 99 });
      expect(getReminders()).toHaveLength(2);

      clearAllReminders();

      expect(getReminders()).toHaveLength(0);
      expect(mockStorage.getItem(REMINDER_STORAGE_KEY)).toBeNull();
    });

    it('handles corrupted localStorage JSON gracefully', () => {
      mockStorage.setItem(REMINDER_STORAGE_KEY, 'invalid-json{{}');

      expect(getReminders()).toEqual([]);
      expect(hasReminder(42)).toBe(false);
    });
  });

  describe('Homescreen App-Badging API (navigator.setAppBadge)', () => {
    const sampleReminder: GameReminder = {
      matchId: 42,
      matchTitle: 'TSG Reutlingen vs. SV 03 Tübingen',
      homeTeamName: 'TSG Reutlingen',
      guestTeamName: 'SV 03 Tübingen',
      kickoffDate: '2026-11-20',
      kickoffTime: '18:00',
      leadTime: '2h',
      createdAt: '2026-10-01T12:00:00.000Z',
    };

    it('sets app badge with active reminder count when count > 0', () => {
      saveReminder(sampleReminder);

      expect(setAppBadgeMock).toHaveBeenCalledWith(1);
    });

    it('clears app badge when active reminder count is 0', () => {
      saveReminder(sampleReminder);
      setAppBadgeMock.mockClear();

      removeReminder(42);

      expect(clearAppBadgeMock).toHaveBeenCalled();
    });

    it('syncAppBadgeWithReminders synchronizes count manually', () => {
      saveReminder(sampleReminder);
      saveReminder({ ...sampleReminder, matchId: 99 });
      setAppBadgeMock.mockClear();

      syncAppBadgeWithReminders();

      expect(setAppBadgeMock).toHaveBeenCalledWith(2);
    });
  });

  describe('pruneExpiredReminders', () => {
    it('prunes matches whose kickoff date has passed and keeps upcoming ones', () => {
      const pastReminder: GameReminder = {
        matchId: 10,
        matchTitle: 'Past Match',
        homeTeamName: 'A',
        guestTeamName: 'B',
        kickoffDate: '2026-10-01',
        kickoffTime: '15:00',
        leadTime: '2h',
        createdAt: '2026-09-01T12:00:00.000Z',
      };

      const futureReminder: GameReminder = {
        matchId: 20,
        matchTitle: 'Future Match',
        homeTeamName: 'C',
        guestTeamName: 'D',
        kickoffDate: '2026-12-01',
        kickoffTime: '15:00',
        leadTime: '2h',
        createdAt: '2026-09-01T12:00:00.000Z',
      };

      saveReminder(pastReminder);
      saveReminder(futureReminder);
      expect(getReminders()).toHaveLength(2);

      // Reference date: Nov 1, 2026
      const refDate = new Date('2026-11-01T12:00:00.000Z');
      const validReminders = pruneExpiredReminders(refDate);

      expect(validReminders).toHaveLength(1);
      expect(validReminders[0].matchId).toBe(20);
      expect(hasReminder(10)).toBe(false);
      expect(hasReminder(20)).toBe(true);
      expect(setAppBadgeMock).toHaveBeenCalledWith(1);
    });
  });
});
