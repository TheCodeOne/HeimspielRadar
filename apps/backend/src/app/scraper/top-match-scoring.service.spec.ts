import {
  calculateHaversineDistanceKm,
  TopMatchScoringService,
} from './top-match-scoring.service';

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
  });
});
