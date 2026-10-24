import { Test, TestingModule } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { PgDialect, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE_DB } from '../database/database.module';
import { LeagueRawData, leagues } from '../database/schema';
import { LeaguesController } from './leagues.controller';
import { MatchesController } from './matches.controller';
import { MatchesService, RelationalMatchRow } from './matches.service';

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

interface MockRow {
  match: {
    id: number;
    leagueId: number;
    matchDay: number;
    matchNo: number | null;
    kickoffDate: string | null;
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

class InMemoryMatchesDatabase {
  mockRows: MockRow[] = [];
  mockLeagueRows: MockLeagueRow[] = [];
  capturedWhereConditions: Array<SQL | undefined> = [];
  findFirstMatch: jest.Mock = jest.fn();

  select() {
    return {
      from: (table: PgTable) => {
        if (table === leagues) {
          const promise = Promise.resolve(this.mockLeagueRows);

          const chain = {
            orderBy: () => Object.assign(promise, chain),
          };

          return Object.assign(promise, chain);
        }

        const promise = Promise.resolve(this.mockRows);

        const chain = {
          innerJoin: () => Object.assign(promise, chain),
          leftJoin: () => Object.assign(promise, chain),
          where: (cond?: SQL) => {
            this.capturedWhereConditions.push(cond);

            return Object.assign(promise, chain);
          },
          orderBy: () => Object.assign(promise, chain),
        };

        return Object.assign(promise, chain);
      },
    };
  }

  query = {
    matches: {
      findFirst: this.findFirstMatch,
    },
  };
}

describe('MatchesService', () => {
  let service: MatchesService;
  let matchesController: MatchesController;
  let leaguesController: LeaguesController;
  let inMemoryDb: InMemoryMatchesDatabase;

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
    inMemoryDb = new InMemoryMatchesDatabase();
    inMemoryDb.mockRows = [sampleRow];
    inMemoryDb.mockLeagueRows = [
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchesController, LeaguesController],
      providers: [
        MatchesService,
        {
          provide: DRIZZLE_DB,
          useValue: inMemoryDb,
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

      inMemoryDb.mockRows = [nonSpatialRow];

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

      inMemoryDb.mockRows = [nonSpatialRow];

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
        dateFrom: undefined,
        dateTo: undefined,
        lat: 48.78,
        lng: 9.18,
        radiusKm: 30,
        leagueId: undefined,
        leagueIds: [1, 2],
        genders: ['männlich', 'weiblich'],
        ageClasses: ['Senioren', 'U18'],
        skillLevels: ['Oberliga', 'Bezirksliga'],
        onlyUpcoming: undefined,
      });
      expect(inMemoryDb.capturedWhereConditions).toHaveLength(1);
      expect(results).toHaveLength(1);
    });

    it('supports filtering by dateFrom and dateTo range via controller and service', async () => {
      const findMatchesSpy = jest.spyOn(service, 'findMatches');

      const results = await matchesController.getMatches(
        undefined,
        '48.78',
        '9.18',
        '30',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'true',
        '2026-10-24',
        '2026-10-25'
      );

      expect(findMatchesSpy).toHaveBeenCalledWith({
        date: undefined,
        dateFrom: '2026-10-24',
        dateTo: '2026-10-25',
        lat: 48.78,
        lng: 9.18,
        radiusKm: 30,
        leagueId: undefined,
        leagueIds: undefined,
        genders: undefined,
        ageClasses: undefined,
        skillLevels: undefined,
        onlyUpcoming: true,
      });
      expect(inMemoryDb.capturedWhereConditions).toHaveLength(1);
      expect(results).toHaveLength(1);
    });

    it('applies 2-hour Europe/Berlin cutoff when onlyUpcoming is true', async () => {
      // 2026-10-18 14:00:00 Europe/Berlin (CEST = UTC+2 -> 12:00:00Z)
      // 2 hours earlier in Berlin is 2026-10-18 12:00
      const dateNowSpy = jest
        .spyOn(Date, 'now')
        .mockReturnValue(new Date('2026-10-18T12:00:00Z').getTime());

      await service.findMatches({
        onlyUpcoming: true,
      });

      expect(inMemoryDb.capturedWhereConditions).toHaveLength(1);
      expect(inMemoryDb.capturedWhereConditions[0]).toBeDefined();

      const dialect = new PgDialect();

      const queryObj = inMemoryDb.capturedWhereConditions[0]
        ? dialect.sqlToQuery(inMemoryDb.capturedWhereConditions[0])
        : { sql: '', params: [] };

      expect(queryObj.params).toContain('2026-10-18');
      expect(queryObj.params).toContain('12:00');

      dateNowSpy.mockRestore();
    });

    it('cleanly maps matches with null kickoffDate and kickoffTime', async () => {
      inMemoryDb.mockRows = [
        {
          ...sampleRow,
          match: {
            ...sampleRow.match,
            id: 2946831,
            kickoffDate: null,
            kickoffTime: null,
          },
        },
      ];

      const results = await service.findMatches({});

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(2946831);
      expect(results[0].kickoffDate).toBeNull();
      expect(results[0].kickoffTime).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns match with league metadata when found by ID', async () => {
      inMemoryDb.findFirstMatch.mockResolvedValueOnce({
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

    it('returns unscheduled match with null kickoffDate and kickoffTime cleanly', async () => {
      inMemoryDb.findFirstMatch.mockResolvedValueOnce({
        id: 2946831,
        leagueId: 53894,
        league: {
          id: 53894,
          dbbId: 53894,
          name: 'BBW3 U18m Bezirkspokal',
        },
        matchDay: 1,
        matchNo: 2,
        kickoffDate: null,
        kickoffTime: null,
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
        venue: null,
        result: null,
        confirmed: false,
      });

      const match = await service.findById(2946831);

      expect(match).not.toBeNull();
      expect(match?.id).toBe(2946831);
      expect(match?.kickoffDate).toBeNull();
      expect(match?.kickoffTime).toBeNull();
    });

    it('returns null when match not found', async () => {
      inMemoryDb.findFirstMatch.mockResolvedValueOnce(null);

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

  describe('mapRelationalMatch & mapLeague', () => {
    it('maps complete relational match row to domain Match DTO', () => {
      const row: RelationalMatchRow = {
        match: {
          id: 100,
          leagueId: 200,
          matchDay: 5,
          matchNo: 501,
          kickoffDate: '2026-10-30',
          kickoffTime: '19:30',
          result: '80:75',
          confirmed: true,
        },
        league: {
          id: 200,
          dbbId: 200,
          name: 'Landesliga',
          seasonId: 2026,
          seasonName: '2026/2027',
          verbandName: 'BBW',
          skName: 'Landesliga',
          akName: 'Senioren',
          geschlecht: 'männlich',
        },
        homeTeam: {
          id: 1,
          dbbId: 10,
          name: 'Home Team',
          shortName: 'HT',
          clubId: 100,
        },
        guestTeam: {
          id: 2,
          dbbId: 20,
          name: 'Guest Team',
          shortName: 'GT',
          clubId: 200,
        },
        venue: {
          id: 50,
          name: 'Test Arena',
          street: 'Main St 1',
          postalCode: '70173',
          city: 'Stuttgart',
          latitude: 48.77,
          longitude: 9.18,
          geocodedAt: new Date('2026-10-01T12:00:00Z'),
        },
        distanceKm: '15.5',
      };

      const result = service.mapRelationalMatch(row);

      expect(result).toEqual({
        id: 100,
        leagueId: 200,
        league: {
          id: 200,
          dbbId: 200,
          name: 'Landesliga',
          seasonId: 2026,
          seasonName: '2026/2027',
          verbandName: 'BBW',
          skName: 'Landesliga',
          akName: 'Senioren',
          geschlecht: 'männlich',
        },
        matchDay: 5,
        matchNo: 501,
        kickoffDate: '2026-10-30',
        kickoffTime: '19:30',
        homeTeam: {
          id: 1,
          dbbId: 10,
          name: 'Home Team',
          shortName: 'HT',
          clubId: 100,
        },
        guestTeam: {
          id: 2,
          dbbId: 20,
          name: 'Guest Team',
          shortName: 'GT',
          clubId: 200,
        },
        venue: {
          id: 50,
          name: 'Test Arena',
          street: 'Main St 1',
          postalCode: '70173',
          city: 'Stuttgart',
          latitude: 48.77,
          longitude: 9.18,
          geocodedAt: '2026-10-01T12:00:00.000Z',
        },
        result: '80:75',
        confirmed: true,
        distanceKm: 15.5,
      });
    });

    it('maps relational match without venue to null venue', () => {
      const row: RelationalMatchRow = {
        match: {
          id: 101,
          leagueId: 200,
          matchDay: 1,
          confirmed: false,
        },
        homeTeam: { id: 1, dbbId: 10, name: 'Home' },
        guestTeam: { id: 2, dbbId: 20, name: 'Guest' },
        venue: null,
      };

      const result = service.mapRelationalMatch(row);

      expect(result.venue).toBeNull();
      expect(result.distanceKm).toBeUndefined();
    });

    it('coalesces league rawData when dedicated columns are null', () => {
      const league = service.mapLeague({
        id: 300,
        name: 'Fallback League',
        skName: null,
        akName: null,
        geschlecht: null,
        rawData: {
          skName: 'Coalesced SK',
          akName: 'Coalesced AK',
          geschlecht: 'mixed',
        },
      });

      expect(league.skName).toBe('Coalesced SK');
      expect(league.akName).toBe('Coalesced AK');
      expect(league.geschlecht).toBe('mixed');
    });
  });
});

