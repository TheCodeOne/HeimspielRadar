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

interface MatchVenuePair {
  id: number;
  venueId: number | null;
}

class FakeDatabase {
  existingVenues: Array<typeof venues.$inferSelect> = [];
  existingMatches: MatchVenuePair[] = [];

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

  insert() {
    return {
      values: () => ({
        onConflictDoUpdate: () => {
          const promise = Promise.resolve([{ id: 1 }]);

          return Object.assign(promise, {
            returning: () => Promise.resolve([{ id: 1 }]),
          });
        },
      }),
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
});
