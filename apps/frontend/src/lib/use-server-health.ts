import * as React from 'react';
import type { HealthCheckResponse } from '@sundayleague/shared-types';

export interface UseServerHealthResult {
  isReady: boolean;
  lastSyncedAt: string | null;
  health: HealthCheckResponse | null;
  latencyMs: number | null;
  refetch: () => Promise<void>;
}

export function useServerHealth(): UseServerHealthResult {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const [health, setHealth] = React.useState<HealthCheckResponse | null>(null);
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);

  const checkHealth = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const res = await fetch('/api/health', { signal });

      const duration = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start
      );

      // 404 means the health route is unconfigured / fallback mode
      if (res.status === 404) {
        setIsReady(true);

        return;
      }

      if (!res.ok) {
        throw new Error(`Health check returned HTTP ${res.status}`);
      }

      // SAFETY: /api/health endpoint returns HealthCheckResponse contract
      const data = (await res.json()) as HealthCheckResponse;

      setLatencyMs(duration);
      setHealth(data);
      setLastSyncedAt(data.lastSyncedAt ?? null);
      setIsReady(true);
    } catch {
      if (signal?.aborted) {
        return;
      }

      setIsReady(true);
    }
  }, []);

  React.useEffect(() => {
    const abortController = new AbortController();

    void checkHealth(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [checkHealth]);

  const refetch = React.useCallback(async () => {
    await checkHealth();
  }, [checkHealth]);

  return {
    isReady,
    lastSyncedAt,
    health,
    latencyMs,
    refetch,
  };
}
