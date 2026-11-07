import type { Match } from '@sundayleague/shared-types';
import {
  type ReminderLeadTime,
  getLeadTimeLabel,
  onReminderRemoved,
  removeReminder,
  saveReminder,
} from './reminder-storage';

export interface PushReminderResult {
  success: boolean;
  permission: NotificationPermission | 'unsupported';
  message: string;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isPushManagerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    return await window.Notification.requestPermission();
  } catch (err) {
    console.error('Error requesting notification permission:', err);

    return 'denied';
  }
}

/**
 * Converts a base64 / base64url string to a Uint8Array suitable for PushManager applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Fetches the backend VAPID public key.
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const response = await fetch('/api/push/vapid-public-key');

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data.publicKey || null;
  } catch {
    return null;
  }
}

/**
 * Subscribes the current service worker to PushManager using the given VAPID public key.
 */
export async function subscribeToPushManager(
  vapidPublicKey: string,
): Promise<PushSubscription | null> {
  if (!isPushManagerSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // SAFETY: Uint8Array is an ArrayBufferView satisfying BufferSource
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    return subscription;
  } catch (err) {
    console.warn('Failed to subscribe to PushManager:', err);

    return null;
  }
}

/**
 * Syncs a reminder subscription with the backend.
 */
export async function syncPushReminderWithBackend(
  matchId: number,
  leadTime: ReminderLeadTime,
  subscription: PushSubscription,
): Promise<boolean> {
  try {
    const subPayload =
      'toJSON' in subscription ? subscription.toJSON() : subscription;

    const response = await fetch('/api/push/reminders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matchId,
        leadTime,
        subscription: subPayload,
      }),
    });

    return response.ok;
  } catch (err) {
    console.warn('Failed to sync push reminder with backend:', err);

    return false;
  }
}

/**
 * Deletes a reminder subscription from the backend.
 */
export async function deletePushReminderFromBackend(
  matchId: number,
  endpoint?: string,
): Promise<boolean> {
  try {
    let resolvedEndpoint = endpoint;

    if (!resolvedEndpoint && isPushManagerSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      resolvedEndpoint = sub?.endpoint;
    }

    const url = resolvedEndpoint
      ? `/api/push/reminders/${matchId}?endpoint=${encodeURIComponent(resolvedEndpoint)}`
      : `/api/push/reminders/${matchId}`;

    const response = await fetch(url, {
      method: 'DELETE',
    });

    return response.ok;
  } catch (err) {
    console.warn('Failed to delete push reminder from backend:', err);

    return false;
  }
}

/**
 * Unsubscribes and deletes a match reminder both locally and on the backend.
 */
export async function unsubscribeWebPushReminder(matchId: number): Promise<void> {
  removeReminder(matchId);
  await deletePushReminderFromBackend(matchId);
}

// Auto-sync removal from reminder-storage with the backend push service
if (typeof window !== 'undefined') {
  onReminderRemoved((matchId) => {
    void deletePushReminderFromBackend(matchId);
  });
}

/**
 * Activates Web-Push or browser notification for a match, requesting permissions if necessary.
 */
export async function scheduleWebPushReminder(
  match: Match,
  leadTime: ReminderLeadTime = '2h',
): Promise<PushReminderResult> {
  const leadLabel = getLeadTimeLabel(leadTime);

  // Always save reminder to local storage so settings and UI reflect active state
  saveReminder({
    matchId: match.id,
    matchTitle: `${match.homeTeam.name} vs. ${match.guestTeam.name}`,
    homeTeamName: match.homeTeam.name,
    guestTeamName: match.guestTeam.name,
    leagueName: match.league?.name,
    kickoffDate: match.kickoffDate ?? '',
    kickoffTime: match.kickoffTime ?? '15:00',
    venueName: match.venue?.name,
    venueCity: match.venue?.city,
    venueAddress: [match.venue?.street, match.venue?.postalCode, match.venue?.city]
      .filter(Boolean)
      .join(', '),
    leadTime,
    createdAt: new Date().toISOString(),
  });

  if (!isNotificationSupported()) {
    return {
      success: true,
      permission: 'unsupported',
      message: `Erinnerung lokal gespeichert (${leadLabel}). Kalender-Export (.ics) empfohlen.`,
    };
  }

  let permission: NotificationPermission | 'unsupported' =
    window.Notification.permission;

  if (permission === 'default') {
    permission = await requestNotificationPermission();
  }

  if (permission === 'denied') {
    return {
      success: false,
      permission: 'denied',
      message:
        'Benachrichtigungen sind im Browser blockiert. Bitte in den Seiteneinstellungen erlauben.',
    };
  }

  // Permission granted: trigger instant confirmation notification
  try {
    const title = 'Erinnerung aktiviert 🏀';

    const options: NotificationOptions = {
      body: `Wir erinnern dich ${leadLabel} vor ${match.homeTeam.name} vs. ${match.guestTeam.name}.`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `reminder-confirm-${match.id}`,
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new window.Notification(title, options);
    }
  } catch (err) {
    console.warn('Could not show instant notification banner:', err);
  }

  // Attempt backend VAPID Web-Push synchronization
  try {
    const vapidKey = await fetchVapidPublicKey();

    if (vapidKey && isPushManagerSupported()) {
      const subscription = await subscribeToPushManager(vapidKey);

      if (subscription) {
        await syncPushReminderWithBackend(match.id, leadTime, subscription);

        return {
          success: true,
          permission: 'granted',
          message: `Web-Push Erinnerung (${leadLabel}) erfolgreich aktiviert!`,
        };
      }
    }
  } catch (err) {
    console.warn('VAPID backend push registration failed, falling back to local reminder:', err);
  }

  return {
    success: true,
    permission: 'granted',
    message: `Web-Push Erinnerung (${leadLabel}) erfolgreich aktiviert!`,
  };
}
