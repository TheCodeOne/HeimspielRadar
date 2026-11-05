import type { Match } from '@sundayleague/shared-types';
import {
  type ReminderLeadTime,
  getLeadTimeLabel,
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

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }

  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error('Error requesting notification permission:', err);

    return 'denied';
  }
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

  let permission: NotificationPermission | 'unsupported' = Notification.permission;

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

  // Permission granted: trigger a confirmation notification
  try {
    const title = `Erinnerung aktiviert 🏀`;

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
      new Notification(title, options);
    }
  } catch (err) {
    console.warn('Could not show instant notification banner:', err);
  }

  return {
    success: true,
    permission: 'granted',
    message: `Web-Push Erinnerung (${leadLabel}) erfolgreich aktiviert!`,
  };
}
