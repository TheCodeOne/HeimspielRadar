import {
  formatIsoTimestamp,
  formatUptime,
  getCommitUrl,
  isGitSha,
  RELEASES_URL,
} from './debug-formatters';

describe('debug-formatters', () => {
  describe('formatUptime', () => {
    it('formats seconds only', () => {
      expect(formatUptime(45)).toBe('45s');
    });

    it('formats minutes and seconds', () => {
      expect(formatUptime(125)).toBe('2m');
    });

    it('formats hours, minutes', () => {
      expect(formatUptime(3665)).toBe('1h 1m');
    });

    it('formats days, hours, minutes', () => {
      expect(formatUptime(90000)).toBe('1d 1h 0m');
    });

    it('handles 0 and negative seconds safely', () => {
      expect(formatUptime(0)).toBe('0s');
      expect(formatUptime(-10)).toBe('0s');
    });
  });

  describe('isGitSha', () => {
    it('returns true for 7-char to 40-char hex strings', () => {
      expect(isGitSha('abc1234')).toBe(true);
      expect(isGitSha('9f2b84a')).toBe(true);
      expect(isGitSha('0123456789abcdef0123456789abcdef01234567')).toBe(true);
    });

    it('returns false for dev, unknown, null, undefined or non-hex strings', () => {
      expect(isGitSha('dev')).toBe(false);
      expect(isGitSha('unknown')).toBe(false);
      expect(isGitSha('')).toBe(false);
      expect(isGitSha(null)).toBe(false);
      expect(isGitSha(undefined)).toBe(false);
      expect(isGitSha('not-a-sha')).toBe(false);
      expect(isGitSha('12345')).toBe(false); // too short
    });
  });

  describe('getCommitUrl and RELEASES_URL', () => {
    it('generates correct commit URL and releases URL', () => {
      expect(getCommitUrl('abc1234')).toBe(
        'https://github.com/TheCodeOne/HeimspielRadar/commit/abc1234'
      );
      expect(RELEASES_URL).toBe('https://github.com/TheCodeOne/HeimspielRadar/releases');
    });
  });

  describe('formatIsoTimestamp', () => {
    it('formats ISO timestamps into Berlin time', () => {
      const formatted = formatIsoTimestamp('2026-11-07T12:00:00.000Z');
      expect(formatted).toContain('07.11.2026');
    });

    it('returns placeholder for missing/invalid timestamp', () => {
      expect(formatIsoTimestamp(null)).toBe('–');
      expect(formatIsoTimestamp(undefined)).toBe('–');
      expect(formatIsoTimestamp('invalid-date')).toBe('invalid-date');
    });
  });
});
