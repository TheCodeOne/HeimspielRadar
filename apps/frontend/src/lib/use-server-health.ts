import * as React from 'react';
import type { HealthCheckResponse } from '@sundayleague/shared-types';

export interface UseServerHealthOptions {
  thresholdMs?: number;
  retryIntervalMs?: number;
  maxRetries?: number;
}

export interface UseServerHealthResult {
  isColdStarting: boolean;
  isReady: boolean;
  isDismissed: boolean;
  dismiss: () => void;
  lastSyncedAt: string | null;
  retryCount: number;
}

export function useServerHealth({
  thresholdMs = 1500,
  retryIntervalMs = 3000,
  maxRetries = 15,
}: UseServerHealthOptions = {}): UseServerHealthResult {
  const [isColdStarting, setIsColdStarting] = React.useState<boolean>(false);
  const [isReady, setIsReady] = React.useState<boolean>(false);
  const [isDismissed, setIsDismissed] = React.useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState<number>(0);

  const dismiss = React.useCallback(() => {
    setIsDismissed(true);
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    let abortController = new AbortController();
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    // Timer that triggers cold-start overlay if server hasn't answered in thresholdMs
    const coldStartTimerId = setTimeout(() => {
      if (isMounted && !isReady) {
        setIsColdStarting(true);
      }
    }, thresholdMs);

    async function checkHealth() {
      try {
        const res = await fetch('/api/health', {
          signal: abortController.signal,
        });

        // 404 means the health route is unconfigured / fallback mode
        if (res.status === 404) {
          if (isMounted) {
            clearTimeout(coldStartTimerId);
            setIsReady(true);
            setIsColdStarting(false);
          }

          return;
        }

        if (!res.ok) {
          throw new Error(`Health check returned HTTP ${res.status}`);
        }

        // SAFETY: /api/health endpoint returns HealthCheckResponse contract
        const data = (await res.json()) as HealthCheckResponse;

        if (isMounted) {
          clearTimeout(coldStartTimerId);
          setLastSyncedAt(data.lastSyncedAt ?? null);
          setIsReady(true);
          setIsColdStarting(false);
        }
      } catch {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        attempts += 1;
        setRetryCount(attempts);

        if (attempts < maxRetries) {
          // Retry pinging while server spins up
          retryTimeoutId = setTimeout(() => {
            abortController = new AbortController();
            void checkHealth();
          }, retryIntervalMs);
        } else {
          // Exhausted retries: gracefully stop cold-start overlay
          setIsColdStarting(false);
          setIsReady(true);
        }
      }
    }

    void checkHealth();

    return () => {
      isMounted = false;
      clearTimeout(coldStartTimerId);

      if (retryTimeoutId !== null) {
        clearTimeout(retryTimeoutId);
      }

      abortController.abort();
    };
  }, [thresholdMs, retryIntervalMs, maxRetries]);

  return {
    isColdStarting,
    isReady,
    isDismissed,
    dismiss,
    lastSyncedAt,
    retryCount,
  };
}
