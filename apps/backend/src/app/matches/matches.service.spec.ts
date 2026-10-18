import { Test, TestingModule } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { DRIZZLE_DB } from '../database/database.module';
import { LeagueRawData } from '../database/schema';
import { LeaguesController } from './leagues.controller';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

interface MockLeagueRow {
  id: number;
  dbbId?: number;
  name: string;
  seasonId?: number | null;
  seasonName?: string | null;
  verbandName?: string | null;
  skName?: string | null;
  akName?: string | null;
  geschlecht?: string | null;
  rawData?: LeagueRawData | null;
}

interface MockSelection {
  dbbId?: object;
  match?: object;
}

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
  league: MockLeagueRow;
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

function createMockQuery<T>(results: T[], onWhere?: (condition?: SQL) => void) {
  const promise = Promise.resolve(results);

  const queryMethods = {
    from: () => Object.assign(promise, queryMethods),
    innerJoin: () => Object.assign(promise, queryMethods),
    leftJoin: () => Object.assign(promise, queryMethods),
    where: (cond?: SQL) => {
      if (onWhere) {
        onWhere(cond);
      }

      return Object.assign(promise, queryMethods);
    },
    orderBy: () => Object.assign(promise, queryMethods),
  };

  return Object.assign(promise, queryMethods);
}

describe('MatchesService', () => {
  let service: MatchesService;
  let matchesController: MatchesController;
  let leaguesController: LeaguesController;
  let mockRows: MockRow[];
  let mockLeagueRows: MockLeagueRow[];
  let mockFindFirst: jest.Mock;
  let capturedWhereConditions: Array<SQL | undefined>;

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
      dbbId: 53941,
      name: 'Bezirksliga',
      seasonId: 2026,
      seasonName: '2026/2027',
      verbandName: 'Baden-Württemberg',
      skName: 'Bezirksliga',
      akName: 'Senioren',
      geschlecht: 'männlich',
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
    mockLeagueRows = [
      {
        id: 1,
        dbbId: 53941,
        name: 'Bezirksliga Herren',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
        skName: 'Bezirksliga',
        akName: 'Senioren',
        geschlecht: 'männlich',
      },
      {
        id: 2,
        dbbId: 53942,
        name: 'Oberliga Damen',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
        skName: null,
        akName: null,
        geschlecht: null,
        rawData: {
          skName: 'Oberliga',
          akName: 'Senioren',
          geschlecht: 'weiblich',
        },
      },
    ];
    mockFindFirst = jest.fn();
    capturedWhereConditions = [];

    const fakeDb = {
      select: jest.fn((selection?: MockSelection) => {
        if (selection && selection.dbbId && !selection.match) {
          return createMockQuery(mockLeagueRows);
        }

        return createMockQuery(mockRows, (cond) => {
          capturedWhereConditions.push(cond);
        });
      }),
      query: {
        matches: {
          findFirst: mockFindFirst,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController, LeaguesController],
      providers: [
        MatchesService,
        {
          provide: DRIZZLE_DB,
          useValue: fakeDb,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    matchesController = module.get<MatchesController>(MatchesController);
    leaguesController = module.get<LeaguesController>(LeaguesController);
  });

  describe('findAllLeagues & LeaguesController', () => {
    it('returns all leagues including skName, akName, and geschlecht with rawData fallback', async () => {
      const leagues = await leaguesController.getLeagues();

      expect(leagues).toHaveLength(2);
      expect(leagues[0]).toEqual({
        id: 1,
        dbbId: 53941,
        name: 'Bezirksliga Herren',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
        skName: 'Bezirksliga',
        akName: 'Senioren',
        geschlecht: 'männlich',
      });
      expect(leagues[1]).toEqual({
        id: 2,
        dbbId: 53942,
        name: 'Oberliga Damen',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
        skName: 'Oberliga',
        akName: 'Senioren',
        geschlecht: 'weiblich',
      });
    });
  });

  describe('findMatches with spatial query and multi-dimensional filters', () => {
    it('executes native PostGIS spatial query and includes league metadata on returned matches', async () => {
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
      expect(results[0].league).toEqual({
        id: 53941,
        dbbId: 53941,
        name: 'Bezirksliga',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
        skName: 'Bezirksliga',
        akName: 'Senioren',
        geschlecht: 'männlich',
      });
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

    it('supports filtering by leagueIds, genders, ageClasses, and skillLevels via controller and service', async () => {
      const findMatchesSpy = jest.spyOn(service, 'findMatches');

      const results = await matchesController.getMatches(
        '2026-10-25',
        '48.78',
        '9.18',
        '30',
        undefined,
        '1,2',
        'männlich,weiblich',
        'Senioren,U18',
        'Oberliga,Bezirksliga'
      );

      expect(findMatchesSpy).toHaveBeenCalledWith({
        date: '2026-10-25',
        lat: 48.78,
        lng: 9.18,
        radiusKm: 30,
        leagueId: undefined,
        leagueIds: [1, 2],
        genders: ['männlich', 'weiblich'],
        ageClasses: ['Senioren', 'U18'],
        skillLevels: ['Oberliga', 'Bezirksliga'],
      });
      expect(capturedWhereConditions).toHaveLength(1);
      expect(results).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns match with league metadata when found by ID', async () => {
      mockFindFirst.mockResolvedValueOnce({
        id: 101,
        leagueId: 53941,
        league: {
          id: 53941,
          dbbId: 53941,
          name: 'Bezirksliga',
          skName: 'Bezirksliga',
          akName: 'Senioren',
          geschlecht: 'männlich',
        },
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
      expect(match?.league?.skName).toBe('Bezirksliga');
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

      await expect(unconfiguredService.findAllLeagues()).rejects.toThrow(
        'Database is not configured'
      );
    });
  });
});

