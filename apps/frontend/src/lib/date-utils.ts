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

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export function getWeekendRange(weeksOffset = 0): DateRange {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
  let daysToSaturday = 0;

  if (dayOfWeek === 6) {
    daysToSaturday = 0;
  } else if (dayOfWeek === 0) {
    daysToSaturday = -1; // Saturday was yesterday
  } else {
    daysToSaturday = 6 - dayOfWeek;
  }

  const saturday = new Date(now);
  saturday.setDate(now.getDate() + daysToSaturday + weeksOffset * 7);

  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  return {
    dateFrom: formatDateToISO(saturday),
    dateTo: formatDateToISO(sunday),
  };
}

export function getThisWeekendSaturdayString(): string {
  return getWeekendRange(0).dateFrom;
}

export function formatDisplayDate(dateStr?: string | null): string {
  if (dateStr === null) {
    return 'Termin offen';
  }

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

export function formatDisplayDateRange(
  dateFrom?: string | null,
  dateTo?: string | null,
): string {
  const from = dateFrom?.trim() || '';
  const to = dateTo?.trim() || '';

  if (!from && !to) {
    return 'Alle Termine';
  }

  if (from && to) {
    if (from === to) {
      return formatDisplayDate(from);
    }

    return `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`;
  }

  if (from) {
    return `Ab ${formatDisplayDate(from)}`;
  }

  return `Bis ${formatDisplayDate(to)}`;
}

export function formatKickoffTime(timeStr?: string | null): string {
  if (!timeStr || timeStr === '00:00') {
    return 'Uhrzeit offen';
  }

  return `${timeStr} Uhr`;
}

export function isSameDay(dateStr1?: string, dateStr2?: string): boolean {
  if (!dateStr1 || !dateStr2) {
    return false;
  }

  return dateStr1 === dateStr2;
}

export interface ChronologicalMatchItem {
  id: number;
  kickoffDate: string | null;
  kickoffTime: string | null;
}

/**
 * Compares two matches chronologically by kickoffDate ascending (null/empty last),
 * then kickoffTime ascending (null/empty/'00:00' last), then id ascending.
 */
export function compareMatchesChronologically(
  a: ChronologicalMatchItem,
  b: ChronologicalMatchItem,
): number {
  const dateA = a.kickoffDate?.trim() || '';
  const dateB = b.kickoffDate?.trim() || '';

  if (dateA !== dateB) {
    if (!dateA) {
      return 1;
    }

    if (!dateB) {
      return -1;
    }

    return dateA.localeCompare(dateB);
  }

  const rawTimeA = a.kickoffTime?.trim() || '';
  const rawTimeB = b.kickoffTime?.trim() || '';
  const timeA = rawTimeA === '00:00' ? '' : rawTimeA;
  const timeB = rawTimeB === '00:00' ? '' : rawTimeB;

  if (timeA !== timeB) {
    if (!timeA) {
      return 1;
    }

    if (!timeB) {
      return -1;
    }

    return timeA.localeCompare(timeB);
  }

  return a.id - b.id;
}

export interface UpcomingCutoff {
  cutoffDateStr: string;
  cutoffTimeStr: string;
}

export function getUpcomingCutoffBerlin(nowMs = Date.now()): UpcomingCutoff {
  const cutoff = new Date(nowMs - 2 * 60 * 60 * 1000);

  const berlinParts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(cutoff);

  const [cutoffDateStr = '', cutoffTimeStr = '00:00'] = berlinParts.split(' ');

  return { cutoffDateStr, cutoffTimeStr };
}

export interface UpcomingMatchCandidate {
  kickoffDate: string | null;
  kickoffTime: string | null;
  result?: string | null;
}

export function isMatchUpcoming(
  match: UpcomingMatchCandidate,
  nowMs = Date.now(),
): boolean {
  const hasResult = match.result != null && match.result.trim().length > 0;

  if (hasResult || !match.kickoffDate) {
    return false;
  }

  const { cutoffDateStr, cutoffTimeStr } = getUpcomingCutoffBerlin(nowMs);

  if (match.kickoffDate > cutoffDateStr) {
    return true;
  }

  if (match.kickoffDate < cutoffDateStr) {
    return false;
  }

  const time = match.kickoffTime?.trim() || '';

  if (!time || time === '00:00') {
    return true;
  }

  return time > cutoffTimeStr;
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
