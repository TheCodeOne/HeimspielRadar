import type { Match, NearbyMatchesQuery } from './basketball.types';
import {
  calculateDistanceKm,
  compareMatchesChronologically,
  evaluateMatchesQuery,
  getUpcomingCutoffBerlin,
  isMatchUpcoming,
  isTeamNumberMatch,
  sortMatches,
} from './match-query';

describe('Shared Domain Specification & Query Evaluation', () => {
  describe('getUpcomingCutoffBerlin', () => {
    it('computes 2-hour cutoff in Europe/Berlin local time', () => {
      // 2026-11-05T20:30:00Z is 21:30 in Europe/Berlin (CET = UTC+1).
      // Cutoff 2 hours earlier is 19:30 on 2026-11-05.
      const timestamp = Date.parse('2026-11-05T20:30:00Z');
      const cutoff = getUpcomingCutoffBerlin(timestamp);

      expect(cutoff.cutoffDateStr).toBe('2026-11-05');
      expect(cutoff.cutoffTimeStr).toBe('19:30');
    });

    it('handles midnight boundary rollbacks across date borders', () => {
      // 2026-11-05T00:30:00Z is 01:30 CET.
      // Cutoff 2 hours earlier is 23:30 on previous day 2026-11-04.
      const timestamp = Date.parse('2026-11-05T00:30:00Z');
      const cutoff = getUpcomingCutoffBerlin(timestamp);

      expect(cutoff.cutoffDateStr).toBe('2026-11-04');
      expect(cutoff.cutoffTimeStr).toBe('23:30');
    });
  });

  describe('isMatchUpcoming', () => {
    const fixedCutoff = {
      cutoffDateStr: '2026-11-05',
      cutoffTimeStr: '18:00',
    };

    it('returns false when match already has a recorded score result', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: '20:00', result: '82:76' },
          fixedCutoff,
        ),
      ).toBe(false);
    });

    it('returns false when kickoffDate is null or undefined', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: null, kickoffTime: '20:00' },
          fixedCutoff,
        ),
      ).toBe(false);
    });

    it('returns true when match is on a future date', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-06', kickoffTime: '10:00' },
          fixedCutoff,
        ),
      ).toBe(true);
    });

    it('returns false when match date is in the past', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-04', kickoffTime: '20:00' },
          fixedCutoff,
        ),
      ).toBe(false);
    });

    it('returns true on cutoff date when kickoffTime is after cutoff time', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: '18:30' },
          fixedCutoff,
        ),
      ).toBe(true);
    });

    it('returns false on cutoff date when kickoffTime is before or equal to cutoff time', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: '18:00' },
          fixedCutoff,
        ),
      ).toBe(false);

      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: '16:00' },
          fixedCutoff,
        ),
      ).toBe(false);
    });

    it('treats missing, empty, or 00:00 kickoffTime on cutoff date as upcoming open schedule', () => {
      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: null },
          fixedCutoff,
        ),
      ).toBe(true);

      expect(
        isMatchUpcoming(
          { kickoffDate: '2026-11-05', kickoffTime: '00:00' },
          fixedCutoff,
        ),
      ).toBe(true);
    });

    it('defaults to current Europe/Berlin cutoff when cutoff is omitted', () => {
      // Future match should be upcoming
      expect(
        isMatchUpcoming({
          kickoffDate: '2099-12-31',
          kickoffTime: '20:00',
        }),
      ).toBe(true);

      // Past match should not be upcoming
      expect(
        isMatchUpcoming({
          kickoffDate: '2000-01-01',
          kickoffTime: '20:00',
        }),
      ).toBe(false);
    });
  });

  describe('calculateDistanceKm', () => {
    it('calculates great-circle distance accurately', () => {
      // Stuttgart (48.7758, 9.1829) to Ludwigsburg (48.8974, 9.1919) is approx 13.5 km
      const distance = calculateDistanceKm(48.7758, 9.1829, 48.8974, 9.1919);

      expect(distance).toBeGreaterThan(13);
      expect(distance).toBeLessThan(14);
    });

    it('returns 0 for identical coordinates', () => {
      const distance = calculateDistanceKm(48.7758, 9.1829, 48.7758, 9.1829);

      expect(distance).toBe(0);
    });
  });

  describe('compareMatchesChronologically', () => {
    it('sorts matches by kickoffDate ascending', () => {
      const a = { id: 1, kickoffDate: '2026-11-06', kickoffTime: '14:00' };
      const b = { id: 2, kickoffDate: '2026-11-05', kickoffTime: '14:00' };

      expect(compareMatchesChronologically(a, b)).toBeGreaterThan(0);
      expect(compareMatchesChronologically(b, a)).toBeLessThan(0);
    });

    it('sorts matches on same date by kickoffTime ascending', () => {
      const a = { id: 1, kickoffDate: '2026-11-05', kickoffTime: '16:00' };
      const b = { id: 2, kickoffDate: '2026-11-05', kickoffTime: '14:00' };

      expect(compareMatchesChronologically(a, b)).toBeGreaterThan(0);
    });

    it('places 00:00 and missing times at the end of the day', () => {
      const normalTime = { id: 1, kickoffDate: '2026-11-05', kickoffTime: '10:00' };
      const openTime = { id: 2, kickoffDate: '2026-11-05', kickoffTime: '00:00' };
      const nullTime = { id: 3, kickoffDate: '2026-11-05', kickoffTime: null };

      expect(compareMatchesChronologically(normalTime, openTime)).toBeLessThan(0);
      expect(compareMatchesChronologically(normalTime, nullTime)).toBeLessThan(0);
    });

    it('falls back to match id as tie breaker', () => {
      const a = { id: 10, kickoffDate: '2026-11-05', kickoffTime: '14:00' };
      const b = { id: 20, kickoffDate: '2026-11-05', kickoffTime: '14:00' };

      expect(compareMatchesChronologically(a, b)).toBeLessThan(0);
    });
  });

  describe('isTeamNumberMatch', () => {
    it('disambiguates first team from reserve teams', () => {
      expect(
        isTeamNumberMatch('TSG Reutlingen', 'TSG', undefined, 'TSG Reutlingen', 'TSG Reutlingen'),
      ).toBe(true);

      expect(
        isTeamNumberMatch('TSG Reutlingen 2', 'TSG2', undefined, 'TSG Reutlingen', 'TSG Reutlingen'),
      ).toBe(false);

      expect(
        isTeamNumberMatch('TSG Reutlingen 2', 'TSG2', 2, 'TSG Reutlingen', 'TSG Reutlingen 2'),
      ).toBe(true);
    });
  });

  describe('sortMatches', () => {
    const sampleMatches: Match[] = [
      {
        id: 1,
        leagueId: 10,
        matchDay: 1,
        kickoffDate: '2026-11-05',
        kickoffTime: '15:00',
        confirmed: true,
        homeTeam: { id: 1, dbbId: 101, name: 'Team A' },
        guestTeam: { id: 2, dbbId: 102, name: 'Team B' },
        distanceKm: 25.0,
      },
      {
        id: 2,
        leagueId: 10,
        matchDay: 1,
        kickoffDate: '2026-11-05',
        kickoffTime: '14:00',
        confirmed: true,
        homeTeam: { id: 3, dbbId: 103, name: 'Team C' },
        guestTeam: { id: 4, dbbId: 104, name: 'Team D' },
        distanceKm: 5.0,
      },
      {
        id: 3,
        leagueId: 10,
        matchDay: 1,
        kickoffDate: '2026-11-05',
        kickoffTime: '18:00',
        confirmed: true,
        homeTeam: { id: 5, dbbId: 105, name: 'Team E' },
        guestTeam: { id: 6, dbbId: 106, name: 'Team F' },
        isFeatured: true,
        distanceKm: 40.0,
      },
    ];

    it('prioritizes featured matches first, then distance', () => {
      const sorted = sortMatches(sampleMatches);

      expect(sorted[0].id).toBe(3); // Featured
      expect(sorted[1].id).toBe(2); // 5.0 km
      expect(sorted[2].id).toBe(1); // 25.0 km
    });

    it('sorts chronologically when teamQuery is active', () => {
      const sorted = sortMatches(sampleMatches, { teamQuery: 'Team' });

      expect(sorted[0].id).toBe(3); // Featured first
      expect(sorted[1].id).toBe(2); // 14:00
      expect(sorted[2].id).toBe(1); // 15:00
    });
  });

  describe('evaluateMatchesQuery', () => {
    const mockMatches: Match[] = [
      {
        id: 101,
        leagueId: 1,
        league: {
          id: 1,
          dbbId: 1001,
          name: 'Oberliga Herren',
          geschlecht: 'm',
          akName: 'Senioren',
          skName: 'Oberliga',
        },
        matchDay: 1,
        kickoffDate: '2026-11-05',
        kickoffTime: '19:00',
        confirmed: true,
        homeTeam: { id: 1, dbbId: 1, name: 'MTV Stuttgart' },
        guestTeam: { id: 2, dbbId: 2, name: 'SV Tübingen' },
        venue: {
          id: 1,
          name: 'Halle 1',
          street: 'Weg 1',
          postalCode: '70173',
          city: 'Stuttgart',
          latitude: 48.7758,
          longitude: 9.1829,
        },
      },
      {
        id: 102,
        leagueId: 2,
        league: {
          id: 2,
          dbbId: 1002,
          name: 'Landesliga Damen',
          geschlecht: 'w',
          akName: 'Senioren',
          skName: 'Landesliga',
        },
        matchDay: 1,
        kickoffDate: '2026-11-05',
        kickoffTime: '17:00',
        result: '60:55',
        confirmed: true,
        homeTeam: { id: 3, dbbId: 3, name: 'MTV Stuttgart 2' },
        guestTeam: { id: 4, dbbId: 4, name: 'VfL Waiblingen' },
        venue: {
          id: 2,
          name: 'Halle 2',
          street: 'Weg 2',
          postalCode: '71332',
          city: 'Waiblingen',
          latitude: 48.8306,
          longitude: 9.3172,
        },
      },
      {
        id: 103,
        leagueId: 1,
        league: {
          id: 1,
          dbbId: 1001,
          name: 'Oberliga Herren',
          geschlecht: 'm',
          akName: 'Senioren',
          skName: 'Oberliga',
        },
        matchDay: 2,
        kickoffDate: '2026-11-10',
        kickoffTime: '18:00',
        confirmed: true,
        homeTeam: { id: 5, dbbId: 5, name: 'SV Tübingen' },
        guestTeam: { id: 1, dbbId: 1, name: 'MTV Stuttgart' },
        venue: {
          id: 3,
          name: 'Halle 3',
          street: 'Weg 3',
          postalCode: '72074',
          city: 'Tübingen',
          latitude: 48.5216,
          longitude: 9.0576,
        },
      },
    ];

    it('filters by exact date and calculates distance', () => {
      const query: NearbyMatchesQuery = {
        date: '2026-11-05',
        lat: 48.7758,
        lng: 9.1829,
        radiusKm: 30,
      };

      const results = evaluateMatchesQuery(mockMatches, query);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(101);
      expect(results[0].distanceKm).toBe(0);
    });

    it('filters upcoming matches and excludes matches with results or past cutoffs', () => {
      // 2026-11-05T19:00:00Z -> cutoff is 2026-11-05 18:00 in CET
      const nowMs = Date.parse('2026-11-05T19:00:00Z');

      const query: NearbyMatchesQuery = {
        onlyUpcoming: true,
      };

      const results = evaluateMatchesQuery(mockMatches, query, nowMs);

      // Match 101: 2026-11-05 19:00 (upcoming)
      // Match 102: has result '60:55' (excluded)
      // Match 103: 2026-11-10 18:00 (upcoming)
      expect(results.map((m) => m.id)).toEqual([101, 103]);
    });

    it('filters by league attributes (gender, age class, skill level)', () => {
      const query: NearbyMatchesQuery = {
        genders: ['w'],
      };

      const results = evaluateMatchesQuery(mockMatches, query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(102);
    });

    it('disambiguates team queries and handles reserve teams', () => {
      const queryFirstTeam: NearbyMatchesQuery = {
        teamQuery: 'MTV Stuttgart',
      };

      const resultsFirst = evaluateMatchesQuery(mockMatches, queryFirstTeam);

      expect(resultsFirst.map((m) => m.id)).toEqual([101, 103]);

      const queryReserveTeam: NearbyMatchesQuery = {
        teamQuery: 'MTV Stuttgart 2',
      };

      const resultsReserve = evaluateMatchesQuery(mockMatches, queryReserveTeam);

      expect(resultsReserve.map((m) => m.id)).toEqual([102]);
    });
  });
});
