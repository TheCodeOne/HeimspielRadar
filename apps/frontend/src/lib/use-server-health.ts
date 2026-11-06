import * as React from 'react';
import type { HealthCheckResponse } from '@sundayleague/shared-types';

export interface UseServerHealthResult {
  isReady: boolean;
  lastSyncedAt: string | null;
}

export function useServerHealth(): UseServerHealthResult {
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function checkHealth() {
      try {
        const res = await fetch('/api/health', {
          signal: abortController.signal,
        });

        // 404 means the health route is unconfigured / fallback mode
        if (res.status === 404) {
          if (isMounted) {
            setIsReady(true);
          }

          return;
        }

        if (!res.ok) {
          throw new Error(`Health check returned HTTP ${res.status}`);
        }

        // SAFETY: /api/health endpoint returns HealthCheckResponse contract
        const data = (await res.json()) as HealthCheckResponse;

        if (isMounted) {
          setLastSyncedAt(data.lastSyncedAt ?? null);
          setIsReady(true);
        }
      } catch {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        setIsReady(true);
      }
    }

    void checkHealth();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  return {
    isReady,
    lastSyncedAt,
  };
}
