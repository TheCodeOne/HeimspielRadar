import type { Match } from '@sundayleague/shared-types';
import {
  splitTeamName,
  isHalloweenSeason,
  resolveStoryTheme,
  formatGamedayDateTime,
  generateStoryImageBlob,
} from './story-image-generator';

const mockMatch: Match = {
  id: 101,
  homeTeam: { id: 1, name: 'TSG Reutlingen 2' },
  guestTeam: { id: 2, name: 'VfL Kirchheim Knights' },
  kickoffDate: '2026-10-31',
  kickoffTime: '17:30',
  league: {
    id: 1,
    name: 'Regionalliga Baden-Württemberg',
    gender: 'm',
    ageClass: 'senioren',
  },
  venue: {
    id: 5,
    name: 'Theodor-Heuss-Sporthalle',
    street: 'Kanzleistraße 12',
    postalCode: '72764',
    city: 'Reutlingen',
    latitude: 48.49,
    longitude: 9.21,
  },
  round: 3,
};

describe('story-image-generator', () => {
  describe('splitTeamName', () => {
    it('splits numbers or roman numeral suffixes from club names', () => {
      expect(splitTeamName('TSG Reutlingen 2')).toEqual({
        base: 'TSG Reutlingen',
        suffix: '2',
      });
      expect(splitTeamName('SV 03 Tigers Tübingen IV')).toEqual({
        base: 'SV 03 Tigers Tübingen',
        suffix: 'IV',
      });
      expect(splitTeamName('SG Mannheim B')).toEqual({
        base: 'SG Mannheim',
        suffix: 'B',
      });
    });

    it('returns untouched base when no suffix exists', () => {
      expect(splitTeamName('VfL Kirchheim Knights')).toEqual({
        base: 'VfL Kirchheim Knights',
      });
    });
  });

  describe('formatGamedayDateTime', () => {
    it('formats date and time cleanly without repeating UHR', () => {
      const formatted = formatGamedayDateTime('2026-10-31', '17:00');

      expect(formatted).not.toContain('Uhr UHR');
      expect(formatted).not.toContain('UHR UHR');
      expect(formatted).toContain('17:00 UHR');
    });

    it('handles open time gracefully', () => {
      const formatted = formatGamedayDateTime('2026-10-31', null);

      expect(formatted).toContain('UHRZEIT OFFEN');
    });
  });

  describe('isHalloweenSeason', () => {
    it('returns true during October 24-31', () => {
      const oct31 = new Date(2026, 9, 31); // 9 is October

      expect(isHalloweenSeason(oct31)).toBe(true);

      const oct24 = new Date(2026, 9, 24);

      expect(isHalloweenSeason(oct24)).toBe(true);
    });

    it('returns false outside October 24-31', () => {
      const oct23 = new Date(2026, 9, 23);

      expect(isHalloweenSeason(oct23)).toBe(false);

      const nov1 = new Date(2026, 10, 1);

      expect(isHalloweenSeason(nov1)).toBe(false);

      const sep15 = new Date(2026, 8, 15);

      expect(isHalloweenSeason(sep15)).toBe(false);
    });
  });

  describe('resolveStoryTheme', () => {
    it('honors explicit theme choice', () => {
      expect(resolveStoryTheme('classic')).toBe('classic');
      expect(resolveStoryTheme('halloween')).toBe('halloween');
    });

    it('resolves auto based on seasonal date', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 9, 30));
      expect(resolveStoryTheme('auto')).toBe('halloween');
      expect(resolveStoryTheme(undefined)).toBe('halloween');

      jest.setSystemTime(new Date(2026, 2, 15));
      expect(resolveStoryTheme('auto')).toBe('classic');
      expect(resolveStoryTheme(undefined)).toBe('classic');
      jest.useRealTimers();
    });
  });

  describe('generateStoryImageBlob', () => {
    it('creates an offscreen canvas and converts to Blob', async () => {
      const mockBlob = new Blob(['fake-image'], { type: 'image/png' });

      const mockToBlob = jest.fn((callback: (blob: Blob | null) => void) => {
        callback(mockBlob);
      });

      const fakeCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue({
          createLinearGradient: () => ({ addColorStop: jest.fn() }),
          createRadialGradient: () => ({ addColorStop: jest.fn() }),
          fillRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          quadraticCurveTo: jest.fn(),
          arc: jest.fn(),
          closePath: jest.fn(),
          fill: jest.fn(),
          stroke: jest.fn(),
          save: jest.fn(),
          restore: jest.fn(),
          setLineDash: jest.fn(),
          translate: jest.fn(),
          scale: jest.fn(),
          fillText: jest.fn(),
          measureText: (text: string) => ({ width: text.length * 10 }),
        }),
        toBlob: mockToBlob,
      };

      const fakeDoc = {
        createElement: jest.fn().mockImplementation((tag: string) => {
          if (tag === 'canvas') {
            return fakeCanvas;
          }

          return {};
        }),
      };

      Object.defineProperty(globalThis, 'document', {
        value: fakeDoc,
        configurable: true,
        writable: true,
      });

      const blob = await generateStoryImageBlob(mockMatch, {
        theme: 'classic',
        customNote: '🎟️ Eintritt frei',
      });

      expect(blob).toBeDefined();
      expect(blob.type).toBe('image/png');
      expect(mockToBlob).toHaveBeenCalled();
    });
  });
});
