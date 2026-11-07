import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { HealthCheckResponse } from '@sundayleague/shared-types';
import { useServerHealth, type UseServerHealthResult } from './use-server-health';

describe('useServerHealth hook', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('initializes with default non-ready state during initial render', () => {
    const captured: UseServerHealthResult[] = [];

    function TestComponent() {
      captured.push(useServerHealth());

      return null;
    }

    renderToString(React.createElement(TestComponent));

    const result = captured[0];

    expect(result.isReady).toBe(false);
    expect(result.lastSyncedAt).toBeNull();
    expect(result.health).toBeNull();
    expect(result.latencyMs).toBeNull();
    expect(result.refetch).toEqual(expect.any(Function));
  });

  it('triggers /api/health when refetch is called', async () => {
    const mockHealth: HealthCheckResponse = {
      status: 'ok',
      timestamp: '2026-11-07T12:00:00.000Z',
      lastSyncedAt: '2026-11-06T18:00:00.000Z',
      version: '0.1.0',
      commitSha: '9f2b84a',
      uptimeSeconds: 1234,
      builtAt: '2026-11-07T10:00:00.000Z',
    };

    const captured: UseServerHealthResult[] = [];

    // SAFETY: Partial mock of native Response object for unit testing hook
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => mockHealth,
    } as Response;

    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    function TestComponent() {
      captured.push(useServerHealth());

      return null;
    }

    renderToString(React.createElement(TestComponent));

    const result = captured[0];

    await result.refetch();

    expect(global.fetch).toHaveBeenCalledWith('/api/health', expect.any(Object));
  });
});
