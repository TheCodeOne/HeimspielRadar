import { Test, TestingModule } from '@nestjs/testing';
import { PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE_DB } from '../database/database.module';
import { venues } from '../database/schema';
import { DbbClientService, DbbMatch, DbbMatchInfoResponse, DbbSpielplanResponse } from './dbb-client.service';
import { GeocoderService } from './geocoder.service';
import { ScraperService } from './scraper.service';


class MockDbbClientService {
  fetchSpielplan = jest.fn<Promise<DbbSpielplanResponse>, [number]>();
  fetchMatchInfo = jest.fn<Promise<DbbMatchInfoResponse>, [number]>();
  fetchAllWamLeagues = jest.fn();
}

class MockGeocoderService {
  geocodeAddress = jest.fn().mockResolvedValue({
    latitude: 48.7758,
    longitude: 9.1829,
    displayName: 'Test Halle, Stuttgart',
  });
}

interface ExistingMatchRow {
  id: number;
  venueId: number | null;
  result?: string | null;
}

type MockInsertEntity = {
  dbbId?: number;
};

type InsertPayload = MockInsertEntity | MockInsertEntity[];

interface InsertCallRecord {
  table: PgTable;
  isBatch: boolean;
  rowCount: number;
}

class FakeDatabase {
  existingVenues: Array<typeof venues.$inferSelect> = [];
  existingMatches: ExistingMatchRow[] = [];
  insertCalls: InsertCallRecord[] = [];

  select() {
    return {
      from: (table: PgTable) => {
        if (table === venues) {
          return Promise.resolve(this.existingVenues);
        }

        return {
          where: () => Promise.resolve(this.existingMatches),
        };
      },
    };
  }

  insert(table: PgTable) {
    return {
      values: (vals: InsertPayload) => {
        const isBatch = Array.isArray(vals);
        const rowCount = isBatch ? vals.length : 1;

        this.insertCalls.push({ table, isBatch, rowCount });

        const returningRows = isBatch
          ? vals.map((item, idx) => ({ id: idx + 1, dbbId: item.dbbId }))
          : [{ id: 1, dbbId: vals.dbbId }];

        return {
          onConflictDoUpdate: () => {
            const promise = Promise.resolve(returningRows);

            return Object.assign(promise, {
              returning: () => Promise.resolve(returningRows),
            });
          },
        };
      },
    };
  }
}

describe('ScraperService', () => {
  let service: ScraperService;
  let mockDbbClient: MockDbbClientService;
  let mockGeocoder: MockGeocoderService;
  let fakeDb: FakeDatabase;

  const sampleMatch: DbbMatch = {
    matchId: 1001,
    matchDay: 1,
    kickoffDate: '2026-10-25',
    kickoffTime: '15:00',
    homeTeam: { seasonTeamId: 10, teamname: 'TV Derendingen' },
    guestTeam: { seasonTeamId: 20, teamname: 'SV 03 Tübingen' },
    result: '75:68',
    ergebnisbestaetigt: true,
  };

  const sampleSpielplan: DbbSpielplanResponse = {
    data: {
      ligaData: {
        ligaId: 53941,
        liganame: 'Kreisliga A',
        seasonId: 2026,
        seasonName: '2026/2027',
        verbandName: 'Baden-Württemberg',
      },
      matches: [sampleMatch],
    },
  };

  beforeEach(async () => {
    mockDbbClient = new MockDbbClientService();
    mockGeocoder = new MockGeocoderService();
    fakeDb = new FakeDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScraperService,
        {
          provide: DRIZZLE_DB,
          useValue: fakeDb,
        },
        {
          provide: DbbClientService,
          useValue: mockDbbClient,
        },
        {
          provide: GeocoderService,
          useValue: mockGeocoder,
        },
      ],
    }).compile();


    service = module.get<ScraperService>(ScraperService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('previewLeague', () => {
    it('should return preview of league schedule without persisting', async () => {
      mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);
      mockDbbClient.fetchMatchInfo.mockResolvedValue({
        data: {
          matchId: 1001,
          matchInfo: {
            spielfeld: {
              id: 999,
              bezeichnung: 'Halle A',
              strasse: 'Sportstr. 1',
              plz: '70173',
              ort: 'Stuttgart',
            },
          },
        },
      });

      const preview = await service.previewLeague(53941);

      expect(preview.league.ligaId).toBe(53941);
      expect(preview.totalMatches).toBe(1);
      expect(preview.sampleMatch?.matchId).toBe(1001);
      expect(preview.sampleVenue?.id).toBe(999);
    });
  });

  describe('syncLeague', () => {
    it('should sync league, fetch matchInfo and geocode new venue if not cached', async () => {
      mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);

      mockDbbClient.fetchMatchInfo.mockResolvedValue({
        data: {
          matchId: 1001,
          matchInfo: {
            spielfeld: {
              id: 999,
              bezeichnung: 'Sportzentrum Derendingen',
              strasse: 'Waldhörnlestr. 24',
              plz: '72072',
              ort: 'Tübingen',
            },
          },
        },
      });

      const result = await service.syncLeague(53941);

      expect(result.leagueId).toBe(53941);
      expect(result.syncedMatches).toBe(1);
      expect(result.syncedVenues).toBe(1);
      expect(result.geocodedVenues).toBe(1);
      expect(mockDbbClient.fetchMatchInfo).toHaveBeenCalledWith(1001);
      expect(mockGeocoder.geocodeAddress).toHaveBeenCalledWith(
        'Waldhörnlestr. 24',
        '72072',
        'Tübingen'
      );
    });

    it('should skip calling fetchMatchInfo if existing match already has a known venueId', async () => {
      mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);
      fakeDb.existingMatches = [{ id: 1001, venueId: 999 }];

      const result = await service.syncLeague(53941);

      expect(result.syncedMatches).toBe(1);
      expect(mockDbbClient.fetchMatchInfo).not.toHaveBeenCalled();
      expect(mockGeocoder.geocodeAddress).not.toHaveBeenCalled();
    });

    it('should skip calling fetchMatchInfo in quickSync mode', async () => {
      mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);

      const result = await service.syncLeague(53941, { quickSync: true });

      expect(result.syncedMatches).toBe(1);
      expect(mockDbbClient.fetchMatchInfo).not.toHaveBeenCalled();
    });

    it('should gracefully handle matches with null homeTeam, guestTeam, or kickoffDate (#30, #31)', async () => {
      const byeMatch: DbbMatch = {
        matchId: 1002,
        matchDay: 1,
        kickoffDate: null,
        kickoffTime: null,
        homeTeam: null,
        guestTeam: null,
      };

      const unscheduledMatch: DbbMatch = {
        matchId: 1003,
        matchDay: 2,
        kickoffDate: null,
        kickoffTime: null,
        homeTeam: { seasonTeamId: 10, teamname: 'TV Derendingen' },
        guestTeam: { seasonTeamId: 20, teamname: 'SV 03 Tübingen' },
      };

      mockDbbClient.fetchSpielplan.mockResolvedValue({
        data: {
          ligaData: sampleSpielplan.data.ligaData,
          matches: [byeMatch, unscheduledMatch],
        },
      });

      const result = await service.syncLeague(53941, { quickSync: true });

      expect(result.totalMatches).toBe(2);
      expect(result.syncedMatches).toBe(1);
    });

    it('should completely skip matches that already have a non-empty result in the DB (#32)', async () => {
      const finishedMatch: DbbMatch = {
        ...sampleMatch,
        matchId: 1001,
        result: '75:68',
      };

      const openMatch: DbbMatch = {
        ...sampleMatch,
        matchId: 1002,
        result: undefined,
      };

      mockDbbClient.fetchSpielplan.mockResolvedValue({
        data: {
          ligaData: sampleSpielplan.data.ligaData,
          matches: [finishedMatch, openMatch],
        },
      });

      fakeDb.existingMatches = [
        { id: 1001, venueId: null, result: '75:68' },
        { id: 1002, venueId: null, result: null },
      ];

      mockDbbClient.fetchMatchInfo.mockResolvedValue({
        data: {
          matchId: 1002,
          matchInfo: {},
        },
      });

      const result = await service.syncLeague(53941);

      expect(result.totalMatches).toBe(2);
      expect(result.syncedMatches).toBe(1);
      expect(mockDbbClient.fetchMatchInfo).toHaveBeenCalledTimes(1);
      expect(mockDbbClient.fetchMatchInfo).toHaveBeenCalledWith(1002);
    });

    it('should deduplicate in-flight venue geocoding across concurrent match workers (#32)', async () => {
      const concurrentMatches: DbbMatch[] = [
        { ...sampleMatch, matchId: 2001, result: undefined },
        { ...sampleMatch, matchId: 2002, result: undefined },
        { ...sampleMatch, matchId: 2003, result: undefined },
      ];

      mockDbbClient.fetchSpielplan.mockResolvedValue({
        data: {
          ligaData: sampleSpielplan.data.ligaData,
          matches: concurrentMatches,
        },
      });

      mockDbbClient.fetchMatchInfo.mockImplementation(async (matchId: number) => ({
        data: {
          matchId,
          matchInfo: {
            spielfeld: {
              id: 777,
              bezeichnung: 'Shared Gym',
              strasse: 'Hauptstr. 1',
              plz: '70173',
              ort: 'Stuttgart',
            },
          },
        },
      }));

      const result = await service.syncLeague(53941, { matchConcurrency: 3 });

      expect(result.syncedMatches).toBe(3);
      expect(mockDbbClient.fetchMatchInfo).toHaveBeenCalledTimes(3);
      expect(mockGeocoder.geocodeAddress).toHaveBeenCalledTimes(1);
      expect(result.syncedVenues).toBe(1);
      expect(result.geocodedVenues).toBe(1);
    });

    it('should batch upsert teams and matches in single multi-row queries (#32)', async () => {
      const m1: DbbMatch = {
        ...sampleMatch,
        matchId: 3001,
        result: undefined,
      };

      const m2: DbbMatch = {
        ...sampleMatch,
        matchId: 3002,
        homeTeam: { seasonTeamId: 30, teamname: 'USC Heidelberg' },
        result: undefined,
      };

      mockDbbClient.fetchSpielplan.mockResolvedValue({
        data: {
          ligaData: sampleSpielplan.data.ligaData,
          matches: [m1, m2],
        },
      });

      await service.syncLeague(53941, { quickSync: true });

      const batchInserts = fakeDb.insertCalls.filter((call) => call.isBatch);

      expect(batchInserts).toHaveLength(2);
      expect(batchInserts[0].rowCount).toBe(3);
      expect(batchInserts[1].rowCount).toBe(2);
    });
  });

  describe('syncVerbandLeagues', () => {
    it('should paginate leagues and sync each one using concurrency limiter', async () => {
      mockDbbClient.fetchAllWamLeagues.mockResolvedValue([
        { ligaId: 1001, liganame: 'Liga 1' },
        { ligaId: 1002, liganame: 'Liga 2' },
      ]);

      const syncLeagueSpy = jest.spyOn(service, 'syncLeague').mockResolvedValue({
        leagueId: 1001,
        leagueName: 'Liga 1',
        totalMatches: 10,
        syncedMatches: 10,
        syncedVenues: 2,
        geocodedVenues: 1,
        durationMs: 15,
      });

      const result = await service.syncVerbandLeagues(1, {
        concurrency: 2,
        throttleMs: 0,
      });

      expect(mockDbbClient.fetchAllWamLeagues).toHaveBeenCalledWith(1);
      expect(syncLeagueSpy).toHaveBeenCalledTimes(2);
      expect(result.totalLeagues).toBe(2);
      expect(result.successfulLeagues).toBe(2);
      expect(result.failedLeagues).toBe(0);
      expect(result.syncedMatches).toBe(20);
    });

    it('should handle individual league failure gracefully without stopping remaining leagues', async () => {
      mockDbbClient.fetchAllWamLeagues.mockResolvedValue([
        { ligaId: 1001, liganame: 'Failing Liga' },
        { ligaId: 1002, liganame: 'Successful Liga' },
      ]);

      jest
        .spyOn(service, 'syncLeague')
        .mockRejectedValueOnce(new Error('Network error on DBB'))
        .mockResolvedValueOnce({
          leagueId: 1002,
          leagueName: 'Successful Liga',
          totalMatches: 5,
          syncedMatches: 5,
          syncedVenues: 1,
          geocodedVenues: 0,
          durationMs: 10,
        });

      const result = await service.syncVerbandLeagues(1, {
        concurrency: 1,
        throttleMs: 0,
      });

      expect(result.totalLeagues).toBe(2);
      expect(result.successfulLeagues).toBe(1);
      expect(result.failedLeagues).toBe(1);
      expect(result.syncedMatches).toBe(5);
    });
  });

  describe('syncAllBawueLeagues', () => {
    it('should delegate to syncVerbandLeagues with Verband ID 1', async () => {
      const syncVerbandSpy = jest.spyOn(service, 'syncVerbandLeagues').mockResolvedValue({
        verbandId: 1,
        totalLeagues: 280,
        successfulLeagues: 280,
        failedLeagues: 0,
        totalMatches: 15000,
        syncedMatches: 15000,
        syncedVenues: 500,
        geocodedVenues: 100,
        durationMs: 5000,
      });

      const result = await service.syncAllBawueLeagues({ quickSync: true });

      expect(syncVerbandSpy).toHaveBeenCalledWith(1, { quickSync: true });
      expect(result.totalLeagues).toBe(280);
    });
  });

  describe('getLastSyncedAt', () => {
    it('should return in-memory lastSyncedAt ISO string if set', async () => {
      const date = new Date('2026-10-18T10:00:00.000Z');
      service.setLastSyncedAt(date);

      const result = await service.getLastSyncedAt();

      expect(result).toBe('2026-10-18T10:00:00.000Z');
    });

    it('should return null when no database and no in-memory timestamp', async () => {
      service.setLastSyncedAt(null);

      const nullDbModule = await Test.createTestingModule({
        providers: [
          ScraperService,
          {
            provide: DRIZZLE_DB,
            useValue: null,
          },
          {
            provide: DbbClientService,
            useValue: mockDbbClient,
          },
          {
            provide: GeocoderService,
            useValue: mockGeocoder,
          },
        ],
      }).compile();

      const nullDbService = nullDbModule.get<ScraperService>(ScraperService);
      const result = await nullDbService.getLastSyncedAt();

      expect(result).toBeNull();
    });
  });
});
