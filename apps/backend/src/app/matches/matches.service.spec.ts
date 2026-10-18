import { Test, TestingModule } from '@nestjs/testing';
import { DRIZZLE_DB } from '../database/database.module';
import { MatchesService } from './matches.service';

interface MockRow {
  match: {
    id: number;
    leagueId: number;
    matchDay: number;
    matchNo: number | null;
    kickoffDate: string;
    kickoffTime: string | null;
    result: string | null;
    confirmed: boolean;
  };
  league: {
    id: number;
    name: string;
  };
  homeTeam: {
    id: number;
    dbbId: number;
    name: string;
    shortName: string | null;
    clubId: number | null;
  };
  guestTeam: {
    id: number;
    dbbId: number;
    name: string;
    shortName: string | null;
    clubId: number | null;
  };
  venue: {
    id: number;
    name: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    geocodedAt: Date | null;
  } | null;
  distanceKm: string | number | null;
}

function createMockQuery(results: MockRow[]) {
  const promise = Promise.resolve(results);

  const queryMethods = {
    from: () => promise,
    innerJoin: () => promise,
    leftJoin: () => promise,
    where: () => promise,
    orderBy: () => promise,
  };

  return Object.assign(promise, queryMethods);
}

describe('MatchesService', () => {
  let service: MatchesService;
  let mockRows: MockRow[];
  let mockFindFirst: jest.Mock;

  const sampleRow: MockRow = {
    match: {
      id: 101,
      leagueId: 53941,
      matchDay: 1,
      matchNo: 1001,
      kickoffDate: '2026-10-25',
      kickoffTime: '18:00',
      result: null,
      confirmed: false,
    },
    league: {
      id: 53941,
      name: 'Bezirksliga',
    },
    homeTeam: {
      id: 1,
      dbbId: 501,
      name: 'TSG Stuttgart',
      shortName: 'TSG',
      clubId: 10,
    },
    guestTeam: {
      id: 2,
      dbbId: 502,
      name: 'MTV Ludwigsburg',
      shortName: 'MTV',
      clubId: 20,
    },
    venue: {
      id: 901,
      name: 'Arena Stuttgart',
      street: 'Hauptstr. 1',
      postalCode: '70173',
      city: 'Stuttgart',
      latitude: 48.7758,
      longitude: 9.1829,
      geocodedAt: new Date('2026-10-01T12:00:00Z'),
    },
    distanceKm: '12.4',
  };

  beforeEach(async () => {
    mockRows = [sampleRow];
    mockFindFirst = jest.fn();

    const fakeDb = {
      select: jest.fn(() => createMockQuery(mockRows)),
      query: {
        matches: {
          findFirst: mockFindFirst,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: DRIZZLE_DB,
          useValue: fakeDb,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  describe('findMatches with spatial query', () => {
    it('executes native PostGIS spatial query when lat and lng are provided', async () => {
      const results = await service.findMatches({
        lat: 48.78,
        lng: 9.18,
        radiusKm: 25,
        date: '2026-10-25',
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(101);
      expect(results[0].distanceKm).toBe(12.4);
      expect(results[0].homeTeam.name).toBe('TSG Stuttgart');
      expect(results[0].venue?.city).toBe('Stuttgart');
    });

    it('falls back to non-spatial query when coordinates are omitted', async () => {
      const nonSpatialRow: MockRow = {
        ...sampleRow,
        distanceKm: null,
      };

      mockRows = [nonSpatialRow];

      const results = await service.findMatches({
        date: '2026-10-25',
        leagueId: 53941,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(101);
      expect(results[0].distanceKm).toBeUndefined();
    });

    it('falls back to non-spatial query when coordinates are NaN or null', async () => {
      const nonSpatialRow: MockRow = {
        ...sampleRow,
        distanceKm: null,
      };

      mockRows = [nonSpatialRow];

      const results = await service.findMatches({
        lat: Number.NaN,
        lng: Number.NaN,
        date: '2026-10-25',
      });

      expect(results).toHaveLength(1);
      expect(results[0].distanceKm).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('returns match when found by ID', async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: 101,
        leagueId: 53941,
        matchDay: 1,
        matchNo: 1001,
        kickoffDate: '2026-10-25',
        kickoffTime: '18:00',
        homeTeam: {
          id: 1,
          dbbId: 501,
          name: 'TSG Stuttgart',
        },
        guestTeam: {
          id: 2,
          dbbId: 502,
          name: 'MTV Ludwigsburg',
        },
        venue: {
          id: 901,
          name: 'Arena Stuttgart',
          street: 'Hauptstr. 1',
          postalCode: '70173',
          city: 'Stuttgart',
          latitude: 48.7758,
          longitude: 9.1829,
          geocodedAt: new Date('2026-10-01T12:00:00Z'),
        },
        result: '82:76',
        confirmed: true,
      });

      const match = await service.findById(101);

      expect(match).not.toBeNull();
      expect(match?.id).toBe(101);
      expect(match?.result).toBe('82:76');
    });

    it('returns null when match not found', async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const match = await service.findById(999);

      expect(match).toBeNull();
    });
  });

  describe('calculateHaversineDistance', () => {
    it('calculates great-circle distance accurately', () => {
      // Stuttgart (48.7758, 9.1829) to Ludwigsburg (48.8974, 9.1919) is approx 13.5 km
      const distance = service.calculateHaversineDistance(
        48.7758,
        9.1829,
        48.8974,
        9.1919
      );

      expect(distance).toBeGreaterThan(13);
      expect(distance).toBeLessThan(14);
    });
  });

  describe('unconfigured database', () => {
    it('throws when database is null', async () => {
      const unconfiguredService = new MatchesService(null);

      await expect(
        unconfiguredService.findMatches({ date: '2026-10-25' })
      ).rejects.toThrow('Database is not configured');
    });
  });
});
