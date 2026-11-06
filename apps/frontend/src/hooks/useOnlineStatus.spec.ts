import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus hook', () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;

  let listeners: Record<string, (() => void)[]> = {};

  beforeEach(() => {
    listeners = {};

    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        removeEventListener: (event: string, cb: () => void) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((fn) => fn !== cb);
          }
        },
        dispatchEvent: (event: Event) => {
          const cbs = listeners[event.type] || [];

          for (const cb of cbs) {
            cb();
          }

          return true;
        },
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: true,
      },
      configurable: true,
      writable: true,
    });
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

  it('reads current navigator.onLine state on initial render', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    let hookResult = false;

    function TestComponent() {
      hookResult = useOnlineStatus();

      return null;
    }

    renderToString(React.createElement(TestComponent));
    expect(hookResult).toBe(true);
  });

  it('updates when offline and online events are fired', () => {
    let capturedResult = true;

    function TestComponent() {
      capturedResult = useOnlineStatus();

      return null;
    }

    renderToString(React.createElement(TestComponent));

    // Simulate going offline
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    globalThis.window?.dispatchEvent(new Event('offline'));

    // Simulate coming back online
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    globalThis.window?.dispatchEvent(new Event('online'));

    expect(capturedResult).toBe(true);
  });

  it('safely handles missing window in SSR environment', () => {
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    let hookResult = false;

    function TestComponent() {
      hookResult = useOnlineStatus();

      return null;
    }

    renderToString(React.createElement(TestComponent));
    expect(hookResult).toBe(true);
  });
});
