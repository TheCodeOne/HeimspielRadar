import * as React from 'react';
import { renderToString } from 'react-dom/server';
import {
  ThemeProvider,
  useTheme,
  THEME_STORAGE_KEY,
  applyThemeToDom,
  getStoredTheme,
  getSystemResolvedTheme,
} from '@/lib/theme';

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

class MockClassList {
  private classes = new Set<string>();

  add(c: string) {
    this.classes.add(c);
  }

  remove(c: string) {
    this.classes.delete(c);
  }

  contains(c: string): boolean {
    return this.classes.has(c);
  }

  clear() {
    this.classes.clear();
  }
}

class MockMetaElement {
  private attrs: Record<string, string> = {};

  setAttribute(name: string, val: string) {
    this.attrs[name] = val;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }
}

describe('useTheme & ThemeProvider', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  let mockStorage: MockStorage;
  let mockClassList: MockClassList;
  let mockMeta: MockMetaElement;
  let matchesDark = true;
  let mediaQueryListeners: ((e: { matches: boolean }) => void)[] = [];

  beforeEach(() => {
    mockStorage = new MockStorage();
    mockClassList = new MockClassList();
    mockMeta = new MockMetaElement();
    mockMeta.setAttribute('content', '#020617');
    mediaQueryListeners = [];
    matchesDark = true;

    const mockDocument = {
      documentElement: {
        classList: mockClassList,
      },
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') {
          return mockMeta;
        }

        return null;
      },
    };

    const mockWindow = {
      localStorage: mockStorage,
      matchMedia: (query: string) => ({
        matches: matchesDark,
        media: query,
        addEventListener: (_event: string, handler: (e: { matches: boolean }) => void) => {
          mediaQueryListeners.push(handler);
        },
        removeEventListener: (_event: string, handler: (e: { matches: boolean }) => void) => {
          mediaQueryListeners = mediaQueryListeners.filter((h) => h !== handler);
        },
      }),
    };

    Object.defineProperty(globalThis, 'document', {
      value: mockDocument,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('provides safe fallback when useTheme is called outside ThemeProvider', () => {
    let captured: ReturnType<typeof useTheme> | undefined;

    function TestComponent() {
      captured = useTheme();

      return null;
    }

    renderToString(React.createElement(TestComponent));

    if (!captured) {
      throw new Error('captured hook is undefined');
    }

    expect(captured.theme).toBe('system');
    expect(captured.resolvedTheme).toBe('dark');
  });

  it('initializes with system mode and resolves light when prefers-color-scheme is false', () => {
    matchesDark = false;
    let hookResult: ReturnType<typeof useTheme> | undefined;

    function Consumer() {
      hookResult = useTheme();

      return null;
    }

    renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(Consumer),
      ),
    );

    if (!hookResult) {
      throw new Error('hookResult is undefined');
    }

    expect(hookResult.theme).toBe('system');
    expect(hookResult.resolvedTheme).toBe('light');
  });

  it('restores saved preference from localStorage', () => {
    mockStorage.setItem(THEME_STORAGE_KEY, 'light');

    let hookResult: ReturnType<typeof useTheme> | undefined;

    function Consumer() {
      hookResult = useTheme();

      return null;
    }

    renderToString(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(Consumer),
      ),
    );

    if (!hookResult) {
      throw new Error('hookResult is undefined');
    }

    expect(hookResult.theme).toBe('light');
    expect(hookResult.resolvedTheme).toBe('light');
  });

  it('applyThemeToDom and helper utilities work correctly', () => {
    applyThemeToDom('dark');
    expect(mockClassList.contains('dark')).toBe(true);
    expect(mockMeta.getAttribute('content')).toBe('#020617');

    applyThemeToDom('light');
    expect(mockClassList.contains('dark')).toBe(false);
    expect(mockMeta.getAttribute('content')).toBe('#ffffff');

    mockStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(getStoredTheme()).toBe('dark');

    mockStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(getStoredTheme()).toBe('light');

    mockStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    expect(getStoredTheme()).toBe('system');

    matchesDark = false;
    expect(getSystemResolvedTheme()).toBe('light');
    matchesDark = true;
    expect(getSystemResolvedTheme()).toBe('dark');
  });

  it('safely handles missing window in SSR', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(getStoredTheme()).toBe('system');
    expect(getSystemResolvedTheme()).toBe('dark');
  });
});
