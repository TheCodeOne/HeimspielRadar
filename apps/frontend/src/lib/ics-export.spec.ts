import type { Match } from '@sundayleague/shared-types';
import {
  escapeIcsText,
  formatIcsLocalDate,
  formatIcsUtcDate,
  generateMatchIcs,
  generateReminderIcs,
  getIcsValarmTrigger,
} from './ics-export';
import type { GameReminder } from './reminder-storage';

describe('ics-export', () => {
  describe('escapeIcsText', () => {
    it('escapes backslashes, semicolons, commas, and newlines per RFC 5545', () => {
      const input = 'Hello\\World; with, commas\nand newlines';
      const output = escapeIcsText(input);

      expect(output).toBe('Hello\\\\World\\; with\\, commas\\nand newlines');
    });
  });

  describe('formatIcsUtcDate', () => {
    it('formats UTC dates into YYYYMMDDTHHmmssZ format', () => {
      const date = new Date(Date.UTC(2026, 10, 5, 20, 30, 45));
      expect(formatIcsUtcDate(date)).toBe('20261105T203045Z');
    });
  });

  describe('formatIcsLocalDate', () => {
    it('formats date and time with 2-hour duration', () => {
      const { start, end } = formatIcsLocalDate('2026-11-08', '15:30');

      expect(start).toBe('20261108T153000');
      expect(end).toBe('20261108T173000');
    });

    it('handles null/missing kickoff time with default 15:00', () => {
      const { start, end } = formatIcsLocalDate('2026-11-08', null);

      expect(start).toBe('20261108T150000');
      expect(end).toBe('20261108T170000');
    });
  });

  describe('getIcsValarmTrigger', () => {
    it('returns RFC 5545 duration strings for each lead time', () => {
      expect(getIcsValarmTrigger('1h')).toBe('-PT1H');
      expect(getIcsValarmTrigger('2h')).toBe('-PT2H');
      expect(getIcsValarmTrigger('1d')).toBe('-P1D');
    });
  });

  describe('generateMatchIcs', () => {
    const mockMatch: Match = {
      id: 555,
      confirmed: true,
      kickoffDate: '2026-11-15',
      kickoffTime: '16:00',
      matchDay: 7,
      leagueId: 44,
      homeTeam: { id: 1, dbbId: 1, name: 'TSG Reutlingen' },
      guestTeam: { id: 2, dbbId: 2, name: 'Tigers Tübingen' },
      venue: {
        id: 10,
        name: 'Theodor-Heuss-Halle',
        street: 'Kanzleistr. 20',
        city: 'Reutlingen',
        postalCode: '72764',
        latitude: 48.49,
        longitude: 9.21,
        kioskDescription: 'Frische Brezeln und Waffeln',
      },
      admissionFee: 'Freier Eintritt',
    };

    it('generates compliant RFC 5545 iCalendar content with CRLF line endings', () => {
      const ics = generateMatchIcs(mockMatch, '2h');

      expect(ics).toContain('BEGIN:VCALENDAR\r\n');
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('PRODID:-//HeimspielRadar//Game Reminder//DE\r\n');
      expect(ics).toContain('BEGIN:VEVENT\r\n');
      expect(ics).toContain('UID:match-555@heimspielradar.de\r\n');
      expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20261115T160000\r\n');
      expect(ics).toContain('DTEND;TZID=Europe/Berlin:20261115T180000\r\n');
      expect(ics).toContain('SUMMARY:Basketball: TSG Reutlingen vs. Tigers Tübingen\r\n');
      expect(ics).toContain('LOCATION:Theodor-Heuss-Halle\\, Kanzleistr. 20\\, 72764 Reutlingen\r\n');
      expect(ics).toContain('BEGIN:VALARM\r\n');
      expect(ics).toContain('TRIGGER:-PT2H\r\n');
      expect(ics).toContain('END:VALARM\r\n');
      expect(ics).toContain('END:VEVENT\r\n');
      expect(ics).toContain('END:VCALENDAR\r\n');
    });

    it('sets 1h VALARM trigger when 1h lead time is selected', () => {
      const ics = generateMatchIcs(mockMatch, '1h');
      expect(ics).toContain('TRIGGER:-PT1H\r\n');
    });

    it('sets 1d VALARM trigger when 1d lead time is selected', () => {
      const ics = generateMatchIcs(mockMatch, '1d');
      expect(ics).toContain('TRIGGER:-P1D\r\n');
    });
  });

  describe('generateReminderIcs', () => {
    it('generates calendar event from stored GameReminder object', () => {
      const reminder: GameReminder = {
        matchId: 777,
        matchTitle: 'Team A vs Team B',
        homeTeamName: 'Team A',
        guestTeamName: 'Team B',
        leagueName: 'Regionalliga',
        kickoffDate: '2026-12-05',
        kickoffTime: '18:00',
        venueName: 'Sporthalle Mitte',
        venueAddress: 'Musterweg 1, 70173 Stuttgart',
        leadTime: '1h',
        createdAt: '2026-11-05T20:00:00Z',
      };

      const ics = generateReminderIcs(reminder);

      expect(ics).toContain('UID:match-777@heimspielradar.de\r\n');
      expect(ics).toContain('DTSTART;TZID=Europe/Berlin:20261205T180000\r\n');
      expect(ics).toContain('SUMMARY:Basketball: Team A vs. Team B\r\n');
      expect(ics).toContain('TRIGGER:-PT1H\r\n');
    });
  });
});
