import type { Match } from '@sundayleague/shared-types';
import { formatLeagueName } from '@/components/map/map-utils';
import type { GameReminder, ReminderLeadTime } from './reminder-storage';

export interface IcsLocalDateRange {
  start: string;
  end: string;
}

/**
 * Escapes characters per RFC 5545 section 3.3.11
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats a Date object to UTC iCalendar format (YYYYMMDDTHHmmssZ).
 */
export function formatIcsUtcDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Formats YYYY-MM-DD and HH:mm to local Berlin iCal format (YYYYMMDDTHHmm00).
 */
export function formatIcsLocalDate(
  dateStr: string,
  timeStr?: string | null,
): IcsLocalDateRange {
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = (timeStr && timeStr !== '00:00' ? timeStr : '15:00').replace(/:/g, '');
  const startHours = parseInt(cleanTime.slice(0, 2), 10) || 15;
  const startMinutes = parseInt(cleanTime.slice(2, 4), 10) || 0;

  const startPadHours = String(startHours).padStart(2, '0');
  const startPadMins = String(startMinutes).padStart(2, '0');
  const start = `${cleanDate}T${startPadHours}${startPadMins}00`;

  // Matches typically last around 2 hours
  const endHours = (startHours + 2) % 24;
  const endPadHours = String(endHours).padStart(2, '0');
  const end = `${cleanDate}T${endPadHours}${startPadMins}00`;

  return { start, end };
}

export function getIcsValarmTrigger(leadTime: ReminderLeadTime): string {
  switch (leadTime) {
    case '1h':
      return '-PT1H';
    case '2h':
      return '-PT2H';
    case '1d':
      return '-P1D';
    default:
      return '-PT2H';
  }
}

/**
 * Generates an RFC 5545 compliant .ics calendar file content string.
 */
export function generateMatchIcs(
  match: Match,
  leadTime: ReminderLeadTime = '2h',
): string {
  const now = new Date();
  const dtStamp = formatIcsUtcDate(now);

  const { start, end } = formatIcsLocalDate(
    match.kickoffDate ?? '2026-01-01',
    match.kickoffTime,
  );

  const league = formatLeagueName(match.leagueId, match.league?.name);
  const summary = `Basketball: ${match.homeTeam.name} vs. ${match.guestTeam.name}`;

  const venueAddressParts = [
    match.venue?.name,
    match.venue?.street,
    [match.venue?.postalCode, match.venue?.city].filter(Boolean).join(' '),
  ].filter(Boolean);

  const location = venueAddressParts.join(', ');

  const descriptionLines = [
    `Heimspiel: ${match.homeTeam.name} gegen ${match.guestTeam.name}`,
    `Liga: ${league}`,
    match.matchDay ? `Spieltag: ${match.matchDay}. Spieltag` : null,
    match.venue?.name ? `Spielort: ${match.venue.name}` : null,
    location ? `Adresse: ${location}` : null,
    match.venue?.kioskDescription
      ? `Kiosk / Verpflegung: ${match.venue.kioskDescription}`
      : null,
    match.admissionFee ? `Eintritt: ${match.admissionFee}` : null,
    '',
    `Erstellt mit HeimspielRadar (https://heimspielradar.de/match/${match.id})`,
  ].filter((line): line is string => line !== null);

  const description = descriptionLines.join('\n');
  const valarmTrigger = getIcsValarmTrigger(leadTime);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeimspielRadar//Game Reminder//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:match-${match.id}@heimspielradar.de`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Berlin:${start}`,
    `DTEND;TZID=Europe/Berlin:${end}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Erinnerung: ${match.homeTeam.name} vs. ${match.guestTeam.name}`)}`,
    `TRIGGER:${valarmTrigger}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return icsLines.join('\r\n') + '\r\n';
}

/**
 * Generates an RFC 5545 compliant .ics calendar file content from a stored GameReminder.
 */
export function generateReminderIcs(reminder: GameReminder): string {
  const now = new Date();
  const dtStamp = formatIcsUtcDate(now);

  const { start, end } = formatIcsLocalDate(
    reminder.kickoffDate || '2026-01-01',
    reminder.kickoffTime,
  );

  const summary = `Basketball: ${reminder.homeTeamName} vs. ${reminder.guestTeamName}`;

  const location = [reminder.venueName, reminder.venueAddress]
    .filter(Boolean)
    .join(', ');

  const descriptionLines = [
    `Heimspiel: ${reminder.homeTeamName} gegen ${reminder.guestTeamName}`,
    reminder.leagueName ? `Liga: ${reminder.leagueName}` : null,
    reminder.venueName ? `Spielort: ${reminder.venueName}` : null,
    location ? `Adresse: ${location}` : null,
    '',
    `Erstellt mit HeimspielRadar (https://heimspielradar.de/match/${reminder.matchId})`,
  ].filter((line): line is string => line !== null);

  const description = descriptionLines.join('\n');
  const valarmTrigger = getIcsValarmTrigger(reminder.leadTime);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HeimspielRadar//Game Reminder//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:match-${reminder.matchId}@heimspielradar.de`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Berlin:${start}`,
    `DTEND;TZID=Europe/Berlin:${end}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Erinnerung: ${reminder.homeTeamName} vs. ${reminder.guestTeamName}`)}`,
    `TRIGGER:${valarmTrigger}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return icsLines.join('\r\n') + '\r\n';
}

function triggerDownload(filename: string, content: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers browser download of RFC 5545 .ics file for a match.
 */
export function downloadMatchIcs(
  match: Match,
  leadTime: ReminderLeadTime = '2h',
): void {
  const icsContent = generateMatchIcs(match, leadTime);
  const homeSlug = match.homeTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const guestSlug = match.guestTeam.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `heimspiel-${homeSlug}-vs-${guestSlug}-${match.id}.ics`;

  triggerDownload(filename, icsContent);
}

/**
 * Triggers browser download of RFC 5545 .ics file for a stored reminder.
 */
export function downloadReminderIcs(reminder: GameReminder): void {
  const icsContent = generateReminderIcs(reminder);
  const homeSlug = reminder.homeTeamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const guestSlug = reminder.guestTeamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const filename = `heimspiel-${homeSlug}-vs-${guestSlug}-${reminder.matchId}.ics`;

  triggerDownload(filename, icsContent);
}
