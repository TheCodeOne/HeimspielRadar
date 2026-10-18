/**
 * Date utility functions for match scheduling and filtering.
 */

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return formatDateToISO(new Date());
}

export function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return formatDateToISO(tomorrow);
}

export function getThisWeekendSaturdayString(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
  let daysToAdd = 0;

  if (dayOfWeek === 6) {
    daysToAdd = 0;
  } else if (dayOfWeek === 0) {
    daysToAdd = -1; // Saturday was yesterday
  } else {
    daysToAdd = 6 - dayOfWeek;
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysToAdd);

  return formatDateToISO(targetDate);
}

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) {
    return 'Alle Termine';
  }

  try {
    const parts = dateStr.split('-');

    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);

      return new Intl.DateTimeFormat('de-DE', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(date);
    }
  } catch {
    // fallback if parsing fails
  }

  return dateStr;
}

export function formatKickoffTime(timeStr?: string): string {
  if (!timeStr) {
    return '--:--';
  }

  return `${timeStr} Uhr`;
}

export function isSameDay(dateStr1?: string, dateStr2?: string): boolean {
  if (!dateStr1 || !dateStr2) {
    return false;
  }

  return dateStr1 === dateStr2;
}

/**
 * Formats the last synchronized timestamp into human-readable German text.
 * Falls back to "Stand: Aktuelle Saison 2026/27" if timestamp is missing or invalid.
 */
export function formatLastSyncedAt(timestamp?: string | null): string {
  if (!timestamp) {
    return 'Stand: Aktuelle Saison 2026/27';
  }

  try {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return 'Stand: Aktuelle Saison 2026/27';
    }

    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const timeFormatted = new Intl.DateTimeFormat('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    if (isToday) {
      return `Stand: Heute, ${timeFormatted} Uhr`;
    }

    if (isYesterday) {
      return `Stand: Gestern, ${timeFormatted} Uhr`;
    }

    const dateFormatted = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

    return `Stand: ${dateFormatted}, ${timeFormatted} Uhr`;
  } catch {
    return 'Stand: Aktuelle Saison 2026/27';
  }
}
