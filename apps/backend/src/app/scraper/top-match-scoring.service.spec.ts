import {
  calculateHaversineDistanceKm,
  compareMatchScoreResults,
  MatchScoreResult,
  selectTopMatches,
  TopMatchScoringService,
} from './top-match-scoring.service';

function createMockScoreResult(overrides: Partial<MatchScoreResult> = {}): MatchScoreResult {
  return {
    matchId: 1,
    leagueId: 1,
    score: 25,
    factors: [],
    reason: 'Test Reason',
    meta: {
      type: 'algorithm',
      score: 25,
      factors: [],
      distanceKm: null,
      homeRank: null,
      guestRank: null,
      totalTeams: null,
    },
    distanceKm: null,
    ...overrides,
  };
}

describe('TopMatchScoringService', () => {
  let service: TopMatchScoringService;

  beforeEach(() => {
    service = new TopMatchScoringService(null);
  });

  describe('calculateHaversineDistanceKm', () => {
    it('computes accurate distance between two coordinates', () => {
      // Stuttgart (48.7758, 9.1829) to Ludwigsburg (48.8974, 9.1919) is ~13.5 km
      const dist = calculateHaversineDistanceKm(48.7758, 9.1829, 48.8974, 9.1919);

      expect(dist).toBeGreaterThan(12);
      expect(dist).toBeLessThan(15);
    });

    it('returns 0 for identical points', () => {
      const dist = calculateHaversineDistanceKm(48.7758, 9.1829, 48.7758, 9.1829);

      expect(dist).toBe(0);
    });
  });

  describe('computeMatchScore', () => {
    it('awards top bonus, neighbor bonus and standings points for 1st vs 2nd place', () => {
      const result = service.computeMatchScore({
        matchId: 101,
        leagueId: 1,
        matchDay: 5,
        homeRank: 1,
        guestRank: 2,
        totalTeams: 10,
        distanceKm: 12,
      });

      // Total score:
      // Base: 2*10 - (1+2) = 17
      // Spitzenbonus: +15
      // Tabellennachbarn: +10
      // Lokalderby (<15km): +25
      // Total: 17 + 15 + 10 + 25 = 67
      expect(result.score).toBe(67);
      expect(result.factors).toHaveLength(4);
      expect(result.reason).toContain('Tabellenplatzierung (+17)');
      expect(result.reason).toContain('Spitzenbonus (+15)');
      expect(result.reason).toContain('Tabellennachbarn (+10)');
      expect(result.reason).toContain('Lokalderby (+25)');
      expect(result.meta.type).toBe('algorithm');
      expect(result.meta.score).toBe(67);
    });

    it('awards standings points, top bonus and neighbor bonus on matchdays 1-3 when standings exist', () => {
      const result = service.computeMatchScore({
        matchId: 104,
        leagueId: 1,
        matchDay: 2,
        homeRank: 1,
        guestRank: 2,
        totalTeams: 10,
        distanceKm: 12,
      });

      // Total score:
      // Base: 2*10 - (1+2) = 17
      // Spitzenbonus: +15
      // Tabellennachbarn: +10
      // Lokalderby (<15km): +25
      // Total: 17 + 15 + 10 + 25 = 67
      expect(result.score).toBe(67);
      expect(result.factors).toHaveLength(4);
      expect(result.reason).toContain('Tabellenplatzierung (+17)');
      expect(result.reason).toContain('Spitzenbonus (+15)');
      expect(result.reason).toContain('Tabellennachbarn (+10)');
      expect(result.reason).toContain('Lokalderby (+25)');
      expect(result.meta.homeRank).toBe(1);
      expect(result.meta.guestRank).toBe(2);
    });

    it('evaluates standings on matchday 1 without derby bonus', () => {
      const result = service.computeMatchScore({
        matchId: 105,
        leagueId: 1,
        matchDay: 1,
        homeRank: 2,
        guestRank: 3,
        totalTeams: 10,
        distanceKm: null,
      });

      // Base: 2*10 - (2+3) = 15
      // Spitzenbonus (homeRank <= 2): +15
      // Tabellennachbarn (|2-3| = 1): +10
      // Total: 40
      expect(result.score).toBe(40);
      expect(result.factors).toHaveLength(3);
    });

    it('awards regional derby bonus when distance is between 15km and 30km', () => {
      const result = service.computeMatchScore({
        matchId: 102,
        leagueId: 1,
        matchDay: 6,
        homeRank: 5,
        guestRank: 7,
        totalTeams: 12,
        distanceKm: 22,
      });

      // Base: 2*12 - (5+7) = 12
      // Regionalderby (<30km): +10
      // Total: 22
      expect(result.score).toBe(22);
      expect(result.factors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Regionalderby', points: 10 }),
        ])
      );
    });

    it('uses early season fallback for matchdays 1-3 when standings are missing', () => {
      const result = service.computeMatchScore({
        matchId: 103,
        leagueId: 1,
        matchDay: 2,
        homeRank: null,
        guestRank: null,
        totalTeams: null,
        distanceKm: 8,
      });

      // Early season (<Spieltag 3) + derby bonus
      expect(result.score).toBe(25);
      expect(result.reason).toContain('Lokalderby (+25)');
    });
  });

  describe('compareMatchScoreResults', () => {
    it('prioritizes higher score as tiebreaker 1', () => {
      const m1 = createMockScoreResult({ matchId: 1, score: 30, distanceKm: 20 });
      const m2 = createMockScoreResult({ matchId: 2, score: 25, distanceKm: 5 });

      expect(compareMatchScoreResults(m1, m2)).toBeLessThan(0);
      expect(compareMatchScoreResults(m2, m1)).toBeGreaterThan(0);
    });

    it('prefers shorter derby distance when scores tie (tiebreaker 2)', () => {
      const longDistanceMatch = createMockScoreResult({
        matchId: 101,
        score: 25,
        distanceKm: 13.2,
      });

      const shortDistanceMatch = createMockScoreResult({
        matchId: 102,
        score: 25,
        distanceKm: 5.0,
      });

      // Shorter distance (5.0 km) must sort before longer distance (13.2 km)
      const sorted = [longDistanceMatch, shortDistanceMatch].sort(compareMatchScoreResults);

      expect(sorted[0].matchId).toBe(102);
      expect(sorted[1].matchId).toBe(101);
    });

    it('falls back to lower match-id when scores and distances are equal (tiebreaker 3)', () => {
      const m1 = createMockScoreResult({ matchId: 200, score: 25, distanceKm: 5.0 });
      const m2 = createMockScoreResult({ matchId: 150, score: 25, distanceKm: 5.0 });

      const sorted = [m1, m2].sort(compareMatchScoreResults);

      expect(sorted[0].matchId).toBe(150);
      expect(sorted[1].matchId).toBe(200);
    });
  });

  describe('selectTopMatches', () => {
    it('limits to at most 2 matches even when all 6 matches have identical derby scores', () => {
      const sixDerbyMatches = [
        createMockScoreResult({ matchId: 1, score: 25, distanceKm: 14.0 }),
        createMockScoreResult({ matchId: 2, score: 25, distanceKm: 5.0 }),
        createMockScoreResult({ matchId: 3, score: 25, distanceKm: 8.2 }),
        createMockScoreResult({ matchId: 4, score: 25, distanceKm: 12.5 }),
        createMockScoreResult({ matchId: 5, score: 25, distanceKm: 9.1 }),
        createMockScoreResult({ matchId: 6, score: 25, distanceKm: 6.4 }),
      ];

      const selected = selectTopMatches(sixDerbyMatches);

      expect(selected).toHaveLength(2);
      expect(selected[0].matchId).toBe(2);
      expect(selected[1].matchId).toBe(6);
    });

    it('selects exactly 1 match by default if second match is outside 5-point corridor', () => {
      const matches = [
        createMockScoreResult({ matchId: 1, score: 30, distanceKm: 10 }),
        createMockScoreResult({ matchId: 2, score: 24, distanceKm: 5 }),
      ];

      const selected = selectTopMatches(matches);

      expect(selected).toHaveLength(1);
      expect(selected[0].matchId).toBe(1);
    });

    it('selects 2 matches when second match is within 5 points and score > 0', () => {
      const matches = [
        createMockScoreResult({ matchId: 1, score: 30, distanceKm: 10 }),
        createMockScoreResult({ matchId: 2, score: 26, distanceKm: 5 }),
      ];

      const selected = selectTopMatches(matches);

      expect(selected).toHaveLength(2);
      expect(selected[0].matchId).toBe(1);
      expect(selected[1].matchId).toBe(2);
    });

    it('returns exactly 1 match when no match has score > 0', () => {
      const matches = [
        createMockScoreResult({ matchId: 20, score: 0 }),
        createMockScoreResult({ matchId: 10, score: 0 }),
      ];

      const selected = selectTopMatches(matches);

      expect(selected).toHaveLength(1);
      expect(selected[0].matchId).toBe(10);
    });
  });

  describe('calculateTopMatches with mock database', () => {
    it('gracefully handles missing database', async () => {
      const summary = await service.calculateTopMatches();

      expect(summary.leaguesProcessed).toBe(0);
      expect(summary.matchesEvaluated).toBe(0);
      expect(summary.topMatchesFeatured).toBe(0);
      expect(summary.preservedAdminCount).toBe(0);
    });

    it('preserves admin-chosen featured matches and does not override them', async () => {
      const updatedMatches: any[] = [];

      let selectCallCount = 0;

      const mockDb: any = {
        select: jest.fn().mockImplementation(() => {
          selectCallCount++;
          const currentCall = selectCallCount;

          let resolvedData: any[] = [];

          if (currentCall === 1) {
            // First call: leagues
            resolvedData = [
              {
                id: 1,
                name: 'Oberliga',
                rawData: {
                  tabelle: [
                    { rang: 1, team: { seasonTeamId: 10, teamname: 'Team A' } },
                    { rang: 2, team: { seasonTeamId: 20, teamname: 'Team B' } },
                    { rang: 3, team: { seasonTeamId: 30, teamname: 'Team C' } },
                  ],
                },
              },
            ];
          } else if (currentCall === 2) {
            // Second call: upcoming matches
            resolvedData = [
              {
                id: 101,
                matchDay: 5,
                kickoffDate: '2026-11-20',
                kickoffTime: '19:00',
                homeTeamId: 1,
                guestTeamId: 2,
                venueId: 10,
                isFeatured: true,
                featuredReason: 'Von Admin ausgewählt',
                featuredMeta: { type: 'admin' },
                result: null,
              },
              {
                id: 102,
                matchDay: 5,
                kickoffDate: '2026-11-20',
                kickoffTime: '20:00',
                homeTeamId: 2,
                guestTeamId: 3,
                venueId: 20,
                isFeatured: false,
                featuredReason: null,
                featuredMeta: null,
                result: null,
              },
            ];
          } else if (currentCall === 3) {
            // Third call: venue coords
            resolvedData = [
              {
                teamId: 1,
                primaryVenueId: 10,
                venueLat: 48.77,
                venueLng: 9.18,
              },
              {
                teamId: 2,
                primaryVenueId: 20,
                venueLat: 48.79,
                venueLng: 9.19,
              },
              {
                teamId: 3,
                primaryVenueId: 30,
                venueLat: 48.95,
                venueLng: 9.35,
              },
            ];
          } else {
            // Fourth call: team rows for rank mapping
            resolvedData = [
              { id: 1, dbbId: 10, name: 'Team A' },
              { id: 2, dbbId: 20, name: 'Team B' },
              { id: 3, dbbId: 30, name: 'Team C' },
            ];
          }

          const promise = Promise.resolve(resolvedData);

          const chain: any = {
            from: () => Object.assign(promise, chain),
            leftJoin: () => Object.assign(promise, chain),
            where: () => Object.assign(promise, chain),
            orderBy: () => Object.assign(promise, chain),
          };

          return Object.assign(promise, chain);
        }),
        update: jest.fn().mockImplementation(() => ({
          set: jest.fn().mockImplementation((vals) => ({
            where: jest.fn().mockImplementation((_condition) => {
              updatedMatches.push(vals);

              return Promise.resolve([vals]);
            }),
          })),
        })),
      };

      const serviceWithDb = new TopMatchScoringService(mockDb);
      const summary = await serviceWithDb.calculateTopMatches();

      expect(summary.preservedAdminCount).toBe(1);
      expect(summary.leaguesProcessed).toBe(1);
    });

    it('qualifies at most 2 matches on a matchday with 6 identical derby matches and prefers shorter distance', async () => {
      const updatedMatches: any[] = [];
      let selectCallCount = 0;

      const mockDb: any = {
        select: jest.fn().mockImplementation(() => {
          selectCallCount++;
          const currentCall = selectCallCount;

          let resolvedData: any[] = [];

          if (currentCall === 1) {
            // First call: leagues with empty standings
            resolvedData = [
              {
                id: 1,
                name: 'Bezirksliga',
                rawData: {
                  tabelle: [],
                },
              },
            ];
          } else if (currentCall === 2) {
            // Second call: 6 matches on matchday 1
            resolvedData = [
              { id: 101, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '14:00', homeTeamId: 1, guestTeamId: 2, venueId: 10, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
              { id: 102, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '15:00', homeTeamId: 3, guestTeamId: 4, venueId: 20, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
              { id: 103, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '16:00', homeTeamId: 5, guestTeamId: 6, venueId: 30, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
              { id: 104, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '17:00', homeTeamId: 7, guestTeamId: 8, venueId: 40, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
              { id: 105, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '18:00', homeTeamId: 9, guestTeamId: 10, venueId: 50, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
              { id: 106, matchDay: 1, kickoffDate: '2026-11-20', kickoffTime: '19:00', homeTeamId: 11, guestTeamId: 12, venueId: 60, isFeatured: false, featuredReason: null, featuredMeta: null, result: null },
            ];
          } else if (currentCall === 3) {
            // Third call: venue coordinates giving distinct derby distances all < 15km (all +25 score)
            resolvedData = [
              { teamId: 1, primaryVenueId: 10, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 2, primaryVenueId: 20, venueLat: 48.88, venueLng: 9.20 }, // ~12.3 km (match 101)
              { teamId: 3, primaryVenueId: 30, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 4, primaryVenueId: 40, venueLat: 48.81, venueLng: 9.18 }, // ~4.4 km (match 102)
              { teamId: 5, primaryVenueId: 50, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 6, primaryVenueId: 60, venueLat: 48.84, venueLng: 9.18 }, // ~7.8 km (match 103)
              { teamId: 7, primaryVenueId: 70, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 8, primaryVenueId: 80, venueLat: 48.85, venueLng: 9.18 }, // ~8.9 km (match 104)
              { teamId: 9, primaryVenueId: 90, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 10, primaryVenueId: 100, venueLat: 48.86, venueLng: 9.18 }, // ~10.0 km (match 105)
              { teamId: 11, primaryVenueId: 110, venueLat: 48.77, venueLng: 9.18 },
              { teamId: 12, primaryVenueId: 120, venueLat: 48.87, venueLng: 9.18 }, // ~11.1 km (match 106)
            ];
          } else {
            // Fourth call: team rows (empty)
            resolvedData = [];
          }

          const promise = Promise.resolve(resolvedData);

          const chain: any = {
            from: () => Object.assign(promise, chain),
            leftJoin: () => Object.assign(promise, chain),
            where: () => Object.assign(promise, chain),
            orderBy: () => Object.assign(promise, chain),
          };

          return Object.assign(promise, chain);
        }),
        update: jest.fn().mockImplementation(() => ({
          set: jest.fn().mockImplementation((vals) => ({
            where: jest.fn().mockImplementation((_condition) => {
              updatedMatches.push(vals);

              return Promise.resolve([vals]);
            }),
          })),
        })),
      };

      const serviceWithDb = new TopMatchScoringService(mockDb);
      const summary = await serviceWithDb.calculateTopMatches();

      // Exactly 2 featured top matches must be qualified out of the 6 derby matches
      expect(summary.topMatchesFeatured).toBe(2);
      const featuredUpdates = updatedMatches.filter((m) => m.isFeatured === true);
      expect(featuredUpdates).toHaveLength(2);
    });
  });
});
