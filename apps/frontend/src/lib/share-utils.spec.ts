import type { Match } from '@sundayleague/shared-types';
import {
  formatMatchShareText,
  getMatchSharePayload,
  getMatchShareUrl,
  shareMatch,
  shareMatchStory,
} from './share-utils';
import * as storyGenerator from './story-image-generator';

describe('share-utils', () => {
  const sampleMatch: Match = {
    id: 98765,
    leagueId: 44101,
    league: {
      id: 12,
      dbbId: 54321,
      name: 'Oberliga Württemberg',
    },
    matchDay: 3,
    kickoffDate: '2026-11-15',
    kickoffTime: '17:30',
    homeTeam: { id: 1, dbbId: 101, name: 'TSV Crailsheim' },
    guestTeam: { id: 2, dbbId: 102, name: 'VfL Kirchheim' },
    venue: {
      id: 501,
      name: 'HAKRO Arena',
      street: 'Haller Str. 75',
      postalCode: '74564',
      city: 'Crailsheim',
      latitude: 49.1342,
      longitude: 10.0712,
    },
    result: null,
    confirmed: true,
  };

  describe('getMatchShareUrl', () => {
    it('generates the URL with current origin or fallback', () => {
      const url = getMatchShareUrl(98765);

      expect(url).toContain('/matches/98765');
    });
  });

  describe('formatMatchShareText', () => {
    it('formats share text with teams, date, time, venue and league correctly', () => {
      const shareText = formatMatchShareText(sampleMatch, 'https://heimspielradar.de/matches/98765');

      expect(shareText).toContain('🏀 Heimspiel: TSV Crailsheim vs VfL Kirchheim');
      expect(shareText).toContain('17:30 Uhr');
      expect(shareText).toContain('HAKRO Arena, Crailsheim');
      expect(shareText).toContain('Oberliga Württemberg');
      expect(shareText).toContain('https://heimspielradar.de/matches/98765');
    });
  });

  describe('getMatchSharePayload', () => {
    it('creates correct title, text, and url', () => {
      const payload = getMatchSharePayload(sampleMatch);

      expect(payload.title).toBe('TSV Crailsheim vs VfL Kirchheim – HeimspielRadar');
      expect(payload.text).toContain('TSV Crailsheim vs VfL Kirchheim');
      expect(payload.url).toContain('/matches/98765');
    });
  });

  describe('shareMatch', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it('uses navigator.share if available and supported', async () => {
      const mockShare = jest.fn().mockResolvedValue(undefined);

      Object.defineProperty(global, 'navigator', {
        value: {
          share: mockShare,
        },
        configurable: true,
        writable: true,
      });

      const onSuccess = jest.fn();
      const result = await shareMatch(sampleMatch, { onSuccess });

      expect(result).toBe('shared');
      expect(mockShare).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith('shared');
    });

    it('falls back to clipboard when navigator.share is absent', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);

      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: {
            writeText: mockWriteText,
          },
        },
        configurable: true,
        writable: true,
      });

      const onSuccess = jest.fn();
      const result = await shareMatch(sampleMatch, { onSuccess });

      expect(result).toBe('copied');
      expect(mockWriteText).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith('copied');
    });

    it('returns "failed" without error when user cancels native share sheet (AbortError)', async () => {
      const abortError = new DOMException('User canceled', 'AbortError');
      const mockShare = jest.fn().mockRejectedValue(abortError);

      Object.defineProperty(global, 'navigator', {
        value: {
          share: mockShare,
        },
        configurable: true,
        writable: true,
      });

      const onSuccess = jest.fn();
      const onError = jest.fn();
      const result = await shareMatch(sampleMatch, { onSuccess, onError });

      expect(result).toBe('failed');
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('shareMatchStory', () => {
    beforeEach(() => {
      jest.spyOn(storyGenerator, 'generateStoryImageBlob').mockResolvedValue(
        new Blob(['story-blob'], { type: 'image/png' })
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('uses navigator.share when canShare with files is supported', async () => {
      const mockShare = jest.fn().mockResolvedValue(undefined);
      const mockCanShare = jest.fn().mockReturnValue(true);
      const mockWriteText = jest.fn().mockResolvedValue(undefined);

      Object.defineProperty(global, 'navigator', {
        value: {
          share: mockShare,
          canShare: mockCanShare,
          clipboard: { writeText: mockWriteText },
        },
        configurable: true,
        writable: true,
      });

      const onSuccess = jest.fn();
      const result = await shareMatchStory(sampleMatch, { onSuccess });

      expect(result).toBe('shared');
      expect(mockCanShare).toHaveBeenCalled();
      expect(mockShare).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('shared');
    });

    it('triggers download fallback on desktop when canShare is false or missing', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined);
      const mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = jest.fn();

      Object.defineProperty(global, 'window', {
        value: {
          location: { origin: 'https://heimspielradar.app' },
          URL: {
            createObjectURL: mockCreateObjectURL,
            revokeObjectURL: mockRevokeObjectURL,
          },
        },
        configurable: true,
        writable: true,
      });

      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
      };

      const mockDoc = {
        createElement: jest.fn().mockImplementation((tag: string) => {
          if (tag === 'a') {
            return mockAnchor;
          }

          return {};
        }),
        body: {
          appendChild: jest.fn(),
          removeChild: jest.fn(),
        },
      };

      Object.defineProperty(global, 'document', {
        value: mockDoc,
        configurable: true,
        writable: true,
      });

      Object.defineProperty(global, 'navigator', {
        value: {
          clipboard: { writeText: mockWriteText },
        },
        configurable: true,
        writable: true,
      });

      const onSuccess = jest.fn();
      const result = await shareMatchStory(sampleMatch, { onSuccess });

      expect(result).toBe('downloaded');
      expect(mockAnchor.download).toBe('heimspiel-98765.png');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith('downloaded');
      expect(mockWriteText).toHaveBeenCalled();
    });
  });
});
