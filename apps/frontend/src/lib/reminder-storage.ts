import * as React from 'react';
import { getUpcomingCutoffBerlin, isMatchUpcoming } from '@/lib/date-utils';

export type ReminderLeadTime = '1h' | '2h' | '1d';

export interface GameReminder {
  matchId: number;
  matchTitle: string;
  homeTeamName: string;
  guestTeamName: string;
  leagueName?: string;
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm
  venueName?: string;
  venueCity?: string;
  venueAddress?: string;
  leadTime: ReminderLeadTime;
  createdAt: string; // ISO timestamp
}

export const REMINDER_STORAGE_KEY = 'heimspiel_game_reminders_v1';
export const REMINDERS_UPDATED_EVENT = 'heimspiel-reminders-updated';

export function getLeadTimeMinutes(leadTime: ReminderLeadTime): number {
  switch (leadTime) {
    case '1h':
      return 60;
    case '2h':
      return 120;
    case '1d':
      return 1440;
    default:
      return 120;
  }
}

export function getLeadTimeLabel(leadTime: ReminderLeadTime): string {
  switch (leadTime) {
    case '1h':
      return '1 Stunde vorher';
    case '2h':
      return '2 Stunden vorher';
    case '1d':
      return '1 Tag vorher';
    default:
      return '2 Stunden vorher';
  }
}

export function parseGameReminder(
  raw: Partial<GameReminder> | null | undefined,
): GameReminder | null {
  if (!raw) {
    return null;
  }

  const matchId = Number(raw.matchId);

  if (!Number.isFinite(matchId) || matchId <= 0) {
    return null;
  }

  const leadTime: ReminderLeadTime =
    raw.leadTime === '1h' || raw.leadTime === '1d' ? raw.leadTime : '2h';

  return {
    matchId,
    matchTitle: String(raw.matchTitle ?? ''),
    homeTeamName: String(raw.homeTeamName ?? ''),
    guestTeamName: String(raw.guestTeamName ?? ''),
    leagueName: raw.leagueName ? String(raw.leagueName) : undefined,
    kickoffDate: String(raw.kickoffDate ?? ''),
    kickoffTime: String(raw.kickoffTime ?? '15:00'),
    venueName: raw.venueName ? String(raw.venueName) : undefined,
    venueCity: raw.venueCity ? String(raw.venueCity) : undefined,
    venueAddress: raw.venueAddress ? String(raw.venueAddress) : undefined,
    leadTime,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

function readStoredReminders(): GameReminder[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const validReminders: GameReminder[] = [];

      for (const item of parsed) {
        // SAFETY: storage items parsed as Partial<GameReminder>
        const reminder = parseGameReminder(item as Partial<GameReminder>);

        if (reminder) {
          validReminders.push(reminder);
        }
      }

      return validReminders;
    }

    return [];
  } catch {
    return [];
  }
}

export function syncAppBadgeWithReminders(): void {
  if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) {
    return;
  }

  try {
    const reminders = readStoredReminders();
    const count = reminders.length;

    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      if ('clearAppBadge' in navigator && Boolean(navigator.clearAppBadge)) {
        navigator.clearAppBadge().catch(() => {});
      } else {
        navigator.setAppBadge(0).catch(() => {});
      }
    }
  } catch {
    // Best-effort badge sync
  }
}

export function getReminders(): GameReminder[] {
  const reminders = readStoredReminders();

  syncAppBadgeWithReminders();

  return reminders;
}

export function pruneExpiredReminders(referenceDate?: Date): GameReminder[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const cutoff = getUpcomingCutoffBerlin(
    referenceDate ? referenceDate.getTime() : Date.now(),
  );

  const existing = readStoredReminders();

  const valid = existing.filter((reminder) =>
    isMatchUpcoming(
      {
        kickoffDate: reminder.kickoffDate,
        kickoffTime: reminder.kickoffTime,
      },
      cutoff,
    ),
  );

  if (valid.length !== existing.length) {
    try {
      window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(valid));
    } catch (err) {
      console.error('Failed to update pruned reminders in localStorage:', err);
    }

    dispatchRemindersUpdated();
  }

  syncAppBadgeWithReminders();

  return valid;
}

export function getReminder(matchId: number): GameReminder | null {
  const reminders = readStoredReminders();

  return reminders.find((r) => r.matchId === matchId) ?? null;
}

export function hasReminder(matchId: number): boolean {
  return getReminder(matchId) !== null;
}

function dispatchRemindersUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDERS_UPDATED_EVENT));
  }
}

export function saveReminder(reminder: GameReminder): void {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = readStoredReminders();
  const index = existing.findIndex((r) => r.matchId === reminder.matchId);

  if (index >= 0) {
    existing[index] = reminder;
  } else {
    existing.push(reminder);
  }

  try {
    window.localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify(existing),
    );
  } catch (err) {
    console.error('Failed to save reminder in localStorage:', err);
  }

  dispatchRemindersUpdated();
  syncAppBadgeWithReminders();
}

export type ReminderRemovalListener = (matchId: number) => void;

const removalListeners = new Set<ReminderRemovalListener>();

export function onReminderRemoved(listener: ReminderRemovalListener): () => void {
  removalListeners.add(listener);

  return () => {
    removalListeners.delete(listener);
  };
}

export function removeReminder(matchId: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = readStoredReminders();
  const filtered = existing.filter((r) => r.matchId !== matchId);

  try {
    window.localStorage.setItem(
      REMINDER_STORAGE_KEY,
      JSON.stringify(filtered),
    );
  } catch (err) {
    console.error('Failed to remove reminder from localStorage:', err);
  }

  for (const listener of removalListeners) {
    try {
      listener(matchId);
    } catch {
      // Best-effort notification
    }
  }

  dispatchRemindersUpdated();
  syncAppBadgeWithReminders();
}

export function clearAllReminders(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = readStoredReminders();

  try {
    window.localStorage.removeItem(REMINDER_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear reminders from localStorage:', err);
  }

  for (const reminder of existing) {
    for (const listener of removalListeners) {
      try {
        listener(reminder.matchId);
      } catch {
        // Best-effort notification
      }
    }
  }

  dispatchRemindersUpdated();
  syncAppBadgeWithReminders();
}

/**
 * React hook to observe active reminders across components in real time.
 */
export function useReminders() {
  const [reminders, setReminders] = React.useState<GameReminder[]>(() =>
    getReminders(),
  );

  React.useEffect(() => {
    const handleUpdate = () => {
      setReminders(getReminders());
    };

    window.addEventListener(REMINDERS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(REMINDERS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    reminders,
    count: reminders.length,
    hasReminder: React.useCallback(
      (matchId: number) => reminders.some((r) => r.matchId === matchId),
      [reminders],
    ),
    getReminder: React.useCallback(
      (matchId: number) => reminders.find((r) => r.matchId === matchId) ?? null,
      [reminders],
    ),
    saveReminder,
    removeReminder,
    clearAllReminders,
  };
}

if (typeof window !== 'undefined') {
  syncAppBadgeWithReminders();
  window.addEventListener(REMINDERS_UPDATED_EVENT, syncAppBadgeWithReminders);
  window.addEventListener('storage', syncAppBadgeWithReminders);
}

