import * as filterStorage from './filter-storage';
import {
  STORY_CLUB_STORAGE_KEY,
  getInitialStoryClub,
  persistStoryClub,
} from './story-club-storage';

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
}

// SAFETY: Test runner global object extended for Node test environment
const testGlobal = globalThis as GlobalWithMocks;

describe('story-club-storage', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    testGlobal.window = {
      localStorage: mockStorage,
    };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete testGlobal.window;
  });

  describe('getInitialStoryClub', () => {
    it('returns the stored club when STORY_CLUB_STORAGE_KEY exists in localStorage', () => {
      mockStorage.setItem(STORY_CLUB_STORAGE_KEY, 'TSG Reutlingen');
      jest.spyOn(filterStorage, 'loadPersistedFilters').mockReturnValue({
        ...filterStorage.DEFAULT_FILTER_STATE,
        teamQuery: 'Other Team',
      });

      const result = getInitialStoryClub();

      expect(result).toBe('TSG Reutlingen');
    });

    it('returns empty string when STORY_CLUB_STORAGE_KEY exists as empty string (cleared by user) and ignores filter fallback', () => {
      mockStorage.setItem(STORY_CLUB_STORAGE_KEY, '');
      jest.spyOn(filterStorage, 'loadPersistedFilters').mockReturnValue({
        ...filterStorage.DEFAULT_FILTER_STATE,
        teamQuery: 'Fallback Team',
      });

      const result = getInitialStoryClub();

      expect(result).toBe('');
    });

    it('falls back to loadPersistedFilters().teamQuery when STORY_CLUB_STORAGE_KEY is null', () => {
      jest.spyOn(filterStorage, 'loadPersistedFilters').mockReturnValue({
        ...filterStorage.DEFAULT_FILTER_STATE,
        teamQuery: 'SV 03 Tübingen',
      });

      const result = getInitialStoryClub();

      expect(result).toBe('SV 03 Tübingen');
    });

    it('returns empty string when key is null and loadPersistedFilters().teamQuery is empty', () => {
      jest.spyOn(filterStorage, 'loadPersistedFilters').mockReturnValue({
        ...filterStorage.DEFAULT_FILTER_STATE,
        teamQuery: '   ',
      });

      const result = getInitialStoryClub();

      expect(result).toBe('');
    });

    it('returns empty string if window.localStorage throws', () => {
      jest.spyOn(mockStorage, 'getItem').mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = getInitialStoryClub();

      expect(result).toBe('');
    });
  });

  describe('persistStoryClub', () => {
    it('persists selected club name to localStorage', () => {
      persistStoryClub('BMA Basketball');

      expect(mockStorage.getItem(STORY_CLUB_STORAGE_KEY)).toBe('BMA Basketball');
    });

    it('persists empty string when cleared so subsequent reloads stay empty', () => {
      persistStoryClub('');

      expect(mockStorage.getItem(STORY_CLUB_STORAGE_KEY)).toBe('');
    });

    it('handles localStorage errors gracefully without throwing', () => {
      jest.spyOn(mockStorage, 'setItem').mockImplementation(() => {
        throw new Error('Quota exceeded');
      });

      expect(() => persistStoryClub('Test')).not.toThrow();
    });
  });
});
