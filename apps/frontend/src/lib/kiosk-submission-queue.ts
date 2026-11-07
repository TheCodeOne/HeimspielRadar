import * as React from 'react';
import type { CreateKioskSubmissionDto } from '@sundayleague/shared-types';

export const KIOSK_QUEUE_STORAGE_KEY = 'heimspielradar:kiosk-queue:v1';
export const KIOSK_QUEUE_UPDATED_EVENT = 'heimspiel-kiosk-queue-updated';
export const KIOSK_QUEUE_SYNCED_EVENT = 'heimspiel-kiosk-queue-synced';

export const KIOSK_SUBMISSION_SUCCESS_MESSAGE =
  'Vielen Dank! Deine Info wurde an die Moderation übermittelt und wird in Kürze freigeschaltet.';

export const KIOSK_SUBMISSION_OFFLINE_QUEUED_MESSAGE =
  'Offline gespeichert – deine Info wird automatisch gesendet, sobald du wieder Empfang hast.';

export const KIOSK_SUBMISSION_SYNCED_MESSAGE =
  'Ausstehende Kiosk-Info wurde erfolgreich übermittelt!';

export interface QueuedKioskSubmission {
  matchId: number;
  matchTitle: string;
  venueName?: string | null;
  payload: CreateKioskSubmissionDto;
  queuedAt: string;
  retryCount: number;
}

export interface SyncPendingResult {
  syncedCount: number;
  failedCount: number;
  syncedMatchIds: number[];
}

let memoryQueue: QueuedKioskSubmission[] = [];
let isInitialized = false;
let isSyncInProgress = false;
let isAutoSyncInitialized = false;

const listeners = new Set<() => void>();

export function parseQueuedSubmission(
  raw: Partial<QueuedKioskSubmission> | null | undefined,
): QueuedKioskSubmission | null {
  if (!raw) {
    return null;
  }

  const matchId = Number(raw.matchId);

  if (!Number.isFinite(matchId) || matchId <= 0) {
    return null;
  }

  const matchTitle = String(raw.matchTitle ?? '');

  if (!matchTitle) {
    return null;
  }

  const payload = raw.payload;

  if (!payload) {
    return null;
  }

  const retryCount = Number(raw.retryCount);
  const safeRetryCount = Number.isFinite(retryCount) && retryCount >= 0 ? retryCount : 0;

  return {
    matchId,
    matchTitle,
    venueName: raw.venueName ? String(raw.venueName) : null,
    payload: {
      scope: payload.scope === 'match' ? 'match' : 'matchday',
      admissionFee: payload.admissionFee ? String(payload.admissionFee) : undefined,
      kioskDescription: payload.kioskDescription ? String(payload.kioskDescription) : undefined,
      parkingNotes: payload.parkingNotes ? String(payload.parkingNotes) : undefined,
      matchNotes: payload.matchNotes ? String(payload.matchNotes) : undefined,
      submitterName: payload.submitterName ? String(payload.submitterName) : undefined,
      submitterRole: payload.submitterRole ? String(payload.submitterRole) : undefined,
    },
    queuedAt: String(raw.queuedAt ?? new Date().toISOString()),
    retryCount: safeRetryCount,
  };
}

function readQueueFromStorage(): QueuedKioskSubmission[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(KIOSK_QUEUE_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    // SAFETY: JSON parse from localStorage
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const validItems: QueuedKioskSubmission[] = [];

    for (const item of parsed) {
      // SAFETY: localStorage JSON array items parsed as Partial<QueuedKioskSubmission>
      const entry = parseQueuedSubmission(item as Partial<QueuedKioskSubmission>);

      if (entry) {
        validItems.push(entry);
      }
    }

    return validItems;
  } catch {
    return [];
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function writeQueueToStorage(queue: QueuedKioskSubmission[]): void {
  memoryQueue = queue;
  isInitialized = true;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(
        KIOSK_QUEUE_STORAGE_KEY,
        JSON.stringify(queue),
      );
    } catch (err) {
      console.error('Failed to save kiosk submission queue to localStorage:', err);
    }

    window.dispatchEvent(new CustomEvent(KIOSK_QUEUE_UPDATED_EVENT));
  }

  notifyListeners();
}

export function getQueuedSubmissions(): QueuedKioskSubmission[] {
  if (!isInitialized) {
    memoryQueue = readQueueFromStorage();
    isInitialized = true;
  }

  return memoryQueue;
}

export function hasPendingKioskSubmission(matchId: number): boolean {
  return getQueuedSubmissions().some((entry) => entry.matchId === matchId);
}

export function enqueueKioskSubmission(submission: {
  matchId: number;
  matchTitle: string;
  venueName?: string | null;
  payload: CreateKioskSubmissionDto;
  queuedAt?: string;
  retryCount?: number;
}): void {
  const current = getQueuedSubmissions();
  const existingIndex = current.findIndex((item) => item.matchId === submission.matchId);

  const entry: QueuedKioskSubmission = {
    matchId: submission.matchId,
    matchTitle: submission.matchTitle,
    venueName: submission.venueName ?? null,
    payload: submission.payload,
    queuedAt: submission.queuedAt ?? new Date().toISOString(),
    retryCount: submission.retryCount ?? 0,
  };

  const updated = [...current];

  if (existingIndex >= 0) {
    updated[existingIndex] = entry;
  } else {
    updated.push(entry);
  }

  writeQueueToStorage(updated);
}

export function removeQueuedSubmission(matchId: number): void {
  const current = getQueuedSubmissions();
  const filtered = current.filter((item) => item.matchId !== matchId);

  if (filtered.length !== current.length) {
    writeQueueToStorage(filtered);
  }
}

export function clearQueuedSubmissions(): void {
  writeQueueToStorage([]);
}

function incrementRetryCount(matchId: number): void {
  const current = getQueuedSubmissions();
  const itemIndex = current.findIndex((entry) => entry.matchId === matchId);

  if (itemIndex >= 0) {
    const updated = [...current];

    updated[itemIndex] = {
      ...updated[itemIndex],
      retryCount: updated[itemIndex].retryCount + 1,
    };

    writeQueueToStorage(updated);
  }
}

export function subscribeKioskQueue(callback: () => void): () => void {
  listeners.add(callback);

  if (typeof window === 'undefined') {
    return () => {
      listeners.delete(callback);
    };
  }

  const handleUpdate = () => {
    memoryQueue = readQueueFromStorage();
    callback();
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === KIOSK_QUEUE_STORAGE_KEY) {
      memoryQueue = readQueueFromStorage();
      callback();
    }
  };

  window.addEventListener(KIOSK_QUEUE_UPDATED_EVENT, handleUpdate);
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener(KIOSK_QUEUE_UPDATED_EVENT, handleUpdate);
    window.removeEventListener('storage', handleStorage);
  };
}

export async function syncPendingKioskSubmissions(): Promise<SyncPendingResult> {
  if (isSyncInProgress) {
    return { syncedCount: 0, failedCount: 0, syncedMatchIds: [] };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, failedCount: 0, syncedMatchIds: [] };
  }

  const currentQueue = getQueuedSubmissions();

  if (currentQueue.length === 0) {
    return { syncedCount: 0, failedCount: 0, syncedMatchIds: [] };
  }

  isSyncInProgress = true;
  notifyListeners();

  let syncedCount = 0;
  let failedCount = 0;
  const syncedMatchIds: number[] = [];

  try {
    for (const entry of currentQueue) {
      try {
        const response = await fetch(`/api/matches/${entry.matchId}/kiosk-submission`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry.payload),
        });

        if (response.ok) {
          syncedCount++;
          syncedMatchIds.push(entry.matchId);
          removeQueuedSubmission(entry.matchId);
        } else if (response.status === 400 || response.status === 404) {
          failedCount++;
          removeQueuedSubmission(entry.matchId);
        } else {
          failedCount++;
          incrementRetryCount(entry.matchId);
          break;
        }
      } catch {
        failedCount++;
        incrementRetryCount(entry.matchId);
        break;
      }
    }
  } finally {
    isSyncInProgress = false;
    notifyListeners();
  }

  if (syncedCount > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(KIOSK_QUEUE_SYNCED_EVENT, {
        detail: { syncedCount, syncedMatchIds },
      }),
    );
  }

  return { syncedCount, failedCount, syncedMatchIds };
}

export function initKioskAutoSync(
  onSynced?: (result: { syncedCount: number; syncedMatchIds: number[] }) => void,
): () => void {
  if (typeof window === 'undefined' || isAutoSyncInitialized) {
    return () => {};
  }

  isAutoSyncInitialized = true;

  const handleOnline = () => {
    void syncPendingKioskSubmissions();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      void syncPendingKioskSubmissions();
    }
  };

  const handleSyncedEvent = (e: Event) => {
    // SAFETY: KIOSK_QUEUE_SYNCED_EVENT detail contains syncedCount and syncedMatchIds
    const customEvent = e as CustomEvent<{ syncedCount: number; syncedMatchIds: number[] }>;

    if (customEvent.detail && customEvent.detail.syncedCount > 0) {
      onSynced?.(customEvent.detail);
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener(KIOSK_QUEUE_SYNCED_EVENT, handleSyncedEvent);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void syncPendingKioskSubmissions();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener(KIOSK_QUEUE_SYNCED_EVENT, handleSyncedEvent);
    isAutoSyncInitialized = false;
  };
}

const SERVER_SNAPSHOT: QueuedKioskSubmission[] = [];

export function useKioskQueue() {
  const queue = React.useSyncExternalStore(
    subscribeKioskQueue,
    getQueuedSubmissions,
    () => SERVER_SNAPSHOT,
  );

  const [isSyncing, setIsSyncing] = React.useState<boolean>(false);

  const hasPendingSubmission = React.useCallback(
    (matchId: number) => queue.some((entry) => entry.matchId === matchId),
    [queue],
  );

  const handleSync = React.useCallback(async () => {
    setIsSyncing(true);

    try {
      return await syncPendingKioskSubmissions();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    queue,
    count: queue.length,
    hasPendingSubmission,
    enqueueSubmission: enqueueKioskSubmission,
    removeSubmission: removeQueuedSubmission,
    clearQueue: clearQueuedSubmissions,
    syncQueue: handleSync,
    isSyncing: isSyncing || isSyncInProgress,
  };
}

export function _resetQueueForTesting(): void {
  memoryQueue = [];
  isInitialized = false;
  isSyncInProgress = false;
  isAutoSyncInitialized = false;
  listeners.clear();
}
