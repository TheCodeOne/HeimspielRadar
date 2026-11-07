import {
  dismissPwaInstall,
  getIsIosSafari,
  getIsStandalone,
  PWA_INSTALL_STORAGE_KEY,
  PWA_SESSION_VISITED_KEY,
  readPwaInstallStorage,
  recordPwaVisit,
  savePwaInstallStorage,
  type PwaInstallStorageData,
} from './usePwaInstall';

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

describe('usePwaInstall helpers & storage', () => {
  let localStorageMock: MockStorage;
  let sessionStorageMock: MockStorage;

  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    localStorageMock = new MockStorage();
    sessionStorageMock = new MockStorage();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe('readPwaInstallStorage & savePwaInstallStorage', () => {
    it('returns default initial values for empty storage', () => {
      const data = readPwaInstallStorage(localStorageMock);

      expect(data).toEqual({
        visitCount: 0,
        dismissed: false,
        dismissedAt: null,
      });
    });

    it('saves and reads back persisted data accurately', () => {
      const toSave: PwaInstallStorageData = {
        visitCount: 3,
        dismissed: true,
        dismissedAt: '2026-11-07T12:00:00.000Z',
      };

      savePwaInstallStorage(toSave, localStorageMock);
      const loaded = readPwaInstallStorage(localStorageMock);

      expect(loaded).toEqual(toSave);
    });

    it('gracefully handles corrupted JSON in storage', () => {
      localStorageMock.setItem(PWA_INSTALL_STORAGE_KEY, '{ invalid json');
      const data = readPwaInstallStorage(localStorageMock);

      expect(data).toEqual({
        visitCount: 0,
        dismissed: false,
        dismissedAt: null,
      });
    });
  });

  describe('recordPwaVisit', () => {
    it('increments visit count when first visiting in a session', () => {
      const firstVisit = recordPwaVisit(localStorageMock, sessionStorageMock);

      expect(firstVisit.visitCount).toBe(1);
      expect(sessionStorageMock.getItem(PWA_SESSION_VISITED_KEY)).toBe('1');
    });

    it('does not increment visit count again within the same session', () => {
      recordPwaVisit(localStorageMock, sessionStorageMock);
      const secondCall = recordPwaVisit(localStorageMock, sessionStorageMock);

      expect(secondCall.visitCount).toBe(1);
    });

    it('increments across multiple distinct sessions', () => {
      const session1 = new MockStorage();
      const session2 = new MockStorage();
      const session3 = new MockStorage();

      recordPwaVisit(localStorageMock, session1);
      recordPwaVisit(localStorageMock, session2);
      const visit3 = recordPwaVisit(localStorageMock, session3);

      expect(visit3.visitCount).toBe(3);
    });
  });

  describe('dismissPwaInstall', () => {
    it('sets dismissed flag to true and records dismissedAt timestamp', () => {
      const beforeDismiss = recordPwaVisit(localStorageMock, sessionStorageMock);
      expect(beforeDismiss.dismissed).toBe(false);

      const dismissed = dismissPwaInstall(localStorageMock);

      expect(dismissed.dismissed).toBe(true);
      expect(dismissed.dismissedAt).toBeTruthy();
      expect(dismissed.visitCount).toBe(1);
    });
  });

  describe('getIsStandalone', () => {
    it('returns true when display-mode matches standalone', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: (query: string) => ({
            matches: query === '(display-mode: standalone)',
          }),
        },
        configurable: true,
        writable: true,
      });

      expect(getIsStandalone()).toBe(true);
    });

    it('returns true when navigator.standalone is true (iOS legacy PWA)', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: false }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          standalone: true,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsStandalone()).toBe(true);
    });

    it('returns false when neither standalone query matches', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: false }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          standalone: false,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsStandalone()).toBe(false);
    });
  });

  describe('getIsIosSafari', () => {
    it('returns true for mobile Safari on iPhone', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: false }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsIosSafari()).toBe(true);
    });

    it('returns false for Chrome on iOS (CriOS)', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: false }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsIosSafari()).toBe(false);
    });

    it('returns false for Android Chrome', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: false }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
          platform: 'Linux armv8l',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsIosSafari()).toBe(false);
    });

    it('returns false when already standalone on iOS', () => {
      Object.defineProperty(globalThis, 'window', {
        value: {
          matchMedia: () => ({ matches: true }),
        },
        configurable: true,
        writable: true,
      });

      Object.defineProperty(globalThis, 'navigator', {
        value: {
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
          platform: 'iPhone',
          maxTouchPoints: 5,
        },
        configurable: true,
        writable: true,
      });

      expect(getIsIosSafari()).toBe(false);
    });
  });
});
