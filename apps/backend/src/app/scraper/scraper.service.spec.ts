import { Test, TestingModule } from '@nestjs/testing';
import { SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE_DB } from '../database/database.module';
import { syncFailures, venues } from '../database/schema';
import {
  DbbClientService,
  DbbMatch,
  DbbMatchInfoResponse,
  DbbSpielplanResponse,
} from './dbb-client.service';
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

type SyncFailureSelect = typeof syncFailures.$inferSelect;

interface MockInsertEntity {
  id?: number;
  dbbId?: number;
  name?: string;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: { lng: number; lat: number } | null;
  geocodedAt?: Date | null;
  rawData?: unknown;
  entityType?: string;
  dbbLeagueId?: number;
  leagueName?: string | null;
  dbbMatchId?: number | null;
  verbandId?: number | null;
  errorMessage?: string;
  retryCount?: number;
  failedAt?: Date;
  updatedAt?: Date;
}

type InsertPayload = MockInsertEntity | MockInsertEntity[];

interface InsertCallRecord {
  table: PgTable;
  isBatch: boolean;
  rowCount: number;
}

interface DbUpdateValues {
  latitude?: number | null;
  longitude?: number | null;
  location?: { lng: number; lat: number } | null;
  geocodedAt?: Date | null;
  errorMessage?: string;
  retryCount?: number | SQL;
  updatedAt?: Date;
}

interface UpdateCallRecord {
  table: PgTable;
  values: DbUpdateValues;
}

interface DeleteCallRecord {
  table: PgTable;
}

function hasSqlParam(clause: SQL | undefined, target: string): boolean {
  if (!clause || !clause.queryChunks) {
    return false;
  }

  for (const chunk of clause.queryChunks) {
    if (!chunk) {
      continue;
    }

    if ('value' in chunk && chunk.value === target) {
      return true;
    }

    if ('queryChunks' in chunk && Array.isArray(chunk.queryChunks)) {
      // SAFETY: Nested SQL object in queryChunks conforming to SQL interface
      if (hasSqlParam(chunk as SQL, target)) {
        return true;
      }
    }
  }

  return false;
}

class FakeDatabase {
  existingVenues: Array<typeof venues.$inferSelect> = [];
  existingMatches: ExistingMatchRow[] = [];
  existingFailures: SyncFailureSelect[] = [];
  insertCalls: InsertCallRecord[] = [];
  updateCalls: UpdateCallRecord[] = [];
  deleteCalls: DeleteCallRecord[] = [];

  select() {
    return {
      from: (table: PgTable) => {
        if (table === venues) {
          const promise = Promise.resolve(this.existingVenues);

          return Object.assign(promise, {
            where: () =>
              Promise.resolve(
                this.existingVenues.filter(
                  (v) => v.latitude === null || v.longitude === null
                )
              ),
          });
        }

        if (table === syncFailures) {
          const makePromiseChain = () => {
            const promise = Promise.resolve(this.existingFailures);

            return Object.assign(promise, {
              where: () => makePromiseChain(),
              orderBy: () => makePromiseChain(),
              limit: () => makePromiseChain(),
            });
          };

          return makePromiseChain();
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
        const items = isBatch ? vals : [vals];
        const rowCount = items.length;

        this.insertCalls.push({ table, isBatch, rowCount });

        if (table === syncFailures) {
          for (const item of items) {
            this.existingFailures.push({
              id: this.existingFailures.length + 1,
              entityType: item.entityType ?? 'league',
              dbbLeagueId: item.dbbLeagueId ?? 0,
              leagueName: item.leagueName ?? null,
              dbbMatchId: item.dbbMatchId ?? null,
              verbandId: item.verbandId ?? null,
              errorMessage: item.errorMessage ?? '',
              retryCount: item.retryCount ?? 0,
              failedAt: item.failedAt ?? new Date(),
              updatedAt: item.updatedAt ?? new Date(),
            });
          }
        }

        if (table === venues) {
          for (const item of items) {
            const v: typeof venues.$inferSelect = {
              id: item.id ?? 1,
              name: item.name ?? 'Venue',
              street: item.street ?? null,
              postalCode: item.postalCode ?? null,
              city: item.city ?? null,
              latitude: item.latitude ?? null,
              longitude: item.longitude ?? null,
              location: item.location ?? null,
              geocodedAt: item.geocodedAt ?? null,
              rawData: item.rawData ?? null,
              updatedAt: new Date(),
            };

            const existingIdx = this.existingVenues.findIndex((x) => x.id === v.id);

            if (existingIdx >= 0) {
              this.existingVenues[existingIdx] = { ...this.existingVenues[existingIdx], ...v };
            } else {
              this.existingVenues.push(v);
            }
          }
        }

        const returningRows = items.map((item, idx) => {
          if (table === venues) {
            const found = this.existingVenues.find((x) => x.id === item.id);

            if (found) {
              return found;
            }
          }

          return { id: idx + 1, dbbId: item.dbbId };
        });

        const promise = Promise.resolve(returningRows);

        return Object.assign(promise, {
          onConflictDoUpdate: () => {
            return Object.assign(Promise.resolve(returningRows), {
              returning: () => Promise.resolve(returningRows),
            });
          },
        });
      },
    };
  }

  update(table: PgTable) {
    return {
      set: (vals: DbUpdateValues) => ({
        where: () => {
          this.updateCalls.push({ table, values: vals });

          const updatedRows: Array<typeof venues.$inferSelect> = [];

          if (table === venues) {
            for (const v of this.existingVenues) {
              if (vals.latitude !== undefined) {
                v.latitude = vals.latitude;
              }

              if (vals.longitude !== undefined) {
                v.longitude = vals.longitude;
              }

              if (vals.location !== undefined) {
                v.location = vals.location;
              }

              if (vals.geocodedAt !== undefined) {
                v.geocodedAt = vals.geocodedAt;
              }

              v.updatedAt = vals.updatedAt ?? new Date();
              updatedRows.push({ ...v });
            }
          }

          if (table === syncFailures) {
            for (const item of this.existingFailures) {
              item.retryCount = (item.retryCount ?? 0) + 1;
              item.updatedAt = new Date();
            }
          }

          const promise = Promise.resolve(updatedRows);

          return Object.assign(promise, {
            returning: () => Promise.resolve(updatedRows),
          });
        },
      }),
    };
  }

  delete(table: PgTable) {
    return {
      where: (clause?: SQL) => {
        this.deleteCalls.push({ table });

        if (table === syncFailures) {
          if (hasSqlParam(clause, 'league')) {
            this.existingFailures = this.existingFailures.filter(
              (f) => f.entityType !== 'league'
            );
          } else if (hasSqlParam(clause, 'match')) {
            this.existingFailures = this.existingFailures.filter(
              (f) => f.entityType !== 'match'
            );
          } else {
            this.existingFailures = [];
          }
        }

        return Promise.resolve();
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

  describe('geocodeMissingVenues', () => {
    it('should geocode venues with missing coordinates and update them in DB', async () => {
      fakeDb.existingVenues = [
        {
          id: 501,
          name: 'Halle 1',
          street: 'Waldhörnlestr. 24',
          postalCode: '72072',
          city: 'Tübingen',
          latitude: null,
          longitude: null,
          location: null,
          geocodedAt: null,
          rawData: null,
          updatedAt: new Date(),
        },
        {
          id: 502,
          name: 'Halle 2',
          street: 'Unknown Str. 99',
          postalCode: '00000',
          city: 'Nowhere',
          latitude: null,
          longitude: null,
          location: null,
          geocodedAt: null,
          rawData: null,
          updatedAt: new Date(),
        },
      ];

      mockGeocoder.geocodeAddress
        .mockResolvedValueOnce({
          latitude: 48.5,
          longitude: 9.05,
          displayName: 'Tübingen',
        })
        .mockResolvedValueOnce(null);

      const result = await service.geocodeMissingVenues();

      expect(result).toEqual({
        totalMissing: 2,
        geocoded: 1,
        failed: 1,
      });
      expect(mockGeocoder.geocodeAddress).toHaveBeenCalledTimes(2);
      expect(fakeDb.updateCalls).toHaveLength(1);
      expect(fakeDb.updateCalls[0].values.latitude).toBe(48.5);
      expect(fakeDb.updateCalls[0].values.longitude).toBe(9.05);
    });
  });

  describe('failure persistence and retry', () => {
    describe('syncLeague failures', () => {
      it('should record failure in sync_failures and rethrow when syncLeague fails', async () => {
        mockDbbClient.fetchSpielplan.mockRejectedValue(new Error('DBB API timeout'));

        await expect(
          service.syncLeague(53941, { verbandId: 1, leagueName: 'Kreisliga A' })
        ).rejects.toThrow('DBB API timeout');

        expect(fakeDb.existingFailures).toHaveLength(1);
        expect(fakeDb.existingFailures[0]).toMatchObject({
          entityType: 'league',
          dbbLeagueId: 53941,
          leagueName: 'Kreisliga A',
          verbandId: 1,
          errorMessage: 'DBB API timeout',
          retryCount: 0,
        });
      });

      it('should record match-level failure in sync_failures when matchInfo fails', async () => {
        mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);
        mockDbbClient.fetchMatchInfo.mockRejectedValue(
          new Error('Match 1001 details unavailable')
        );

        const result = await service.syncLeague(53941, { verbandId: 1 });

        expect(result.leagueId).toBe(53941);
        expect(fakeDb.existingFailures).toHaveLength(1);
        expect(fakeDb.existingFailures[0]).toMatchObject({
          entityType: 'match',
          dbbLeagueId: 53941,
          dbbMatchId: 1001,
          errorMessage: 'Match 1001 details unavailable',
          retryCount: 0,
        });
      });

      it('should clear failures from sync_failures when league completes with 0 match errors', async () => {
        mockDbbClient.fetchSpielplan.mockResolvedValue(sampleSpielplan);
        mockDbbClient.fetchMatchInfo.mockResolvedValue({
          data: {
            matchId: 1001,
            matchInfo: {},
          },
        });

        fakeDb.existingFailures = [
          {
            id: 1,
            entityType: 'league',
            dbbLeagueId: 53941,
            leagueName: 'Kreisliga A',
            dbbMatchId: null,
            verbandId: 1,
            errorMessage: 'Previous failure',
            retryCount: 1,
            failedAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        await service.syncLeague(53941);

        const deleteFailureCalls = fakeDb.deleteCalls.filter(
          (call) => call.table === syncFailures
        );

        expect(deleteFailureCalls.length).toBeGreaterThanOrEqual(1);
        expect(fakeDb.existingFailures).toHaveLength(0);
      });
    });

    describe('getFailures', () => {
      it('should return all failures ordered by failedAt descending', async () => {
        const failure1 = {
          id: 1,
          entityType: 'league',
          dbbLeagueId: 53941,
          leagueName: 'Kreisliga A',
          dbbMatchId: null,
          verbandId: 1,
          errorMessage: 'Err 1',
          retryCount: 0,
          failedAt: new Date('2026-10-19T10:00:00Z'),
          updatedAt: new Date('2026-10-19T10:00:00Z'),
        };

        const failure2 = {
          id: 2,
          entityType: 'match',
          dbbLeagueId: 53942,
          leagueName: 'Bezirksliga',
          dbbMatchId: 2002,
          verbandId: 1,
          errorMessage: 'Err 2',
          retryCount: 1,
          failedAt: new Date('2026-10-19T11:00:00Z'),
          updatedAt: new Date('2026-10-19T11:00:00Z'),
        };

        fakeDb.existingFailures = [failure1, failure2];

        const failures = await service.getFailures();

        expect(failures).toHaveLength(2);
      });

      it('should return empty array if db is not configured', async () => {
        const nullDbModule = await Test.createTestingModule({
          providers: [
            ScraperService,
            { provide: DRIZZLE_DB, useValue: null },
            { provide: DbbClientService, useValue: mockDbbClient },
            { provide: GeocoderService, useValue: mockGeocoder },
          ],
        }).compile();

        const nullDbService = nullDbModule.get<ScraperService>(ScraperService);
        const failures = await nullDbService.getFailures();

        expect(failures).toEqual([]);
      });
    });

    describe('retryFailed', () => {
      it('should load distinct dbbLeagueIds, re-run syncLeague for each, and return summary', async () => {
        fakeDb.existingFailures = [
          {
            id: 1,
            entityType: 'league',
            dbbLeagueId: 53941,
            leagueName: 'Kreisliga A',
            dbbMatchId: null,
            verbandId: 1,
            errorMessage: 'Timeout',
            retryCount: 0,
            failedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 2,
            entityType: 'match',
            dbbLeagueId: 53941,
            leagueName: 'Kreisliga A',
            dbbMatchId: 1001,
            verbandId: 1,
            errorMessage: 'Match err',
            retryCount: 0,
            failedAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        const syncLeagueSpy = jest
          .spyOn(service, 'syncLeague')
          .mockImplementation(async (id: number) => {
            fakeDb.existingFailures = [];

            return {
              leagueId: id,
              leagueName: 'Kreisliga A',
              totalMatches: 1,
              syncedMatches: 1,
              syncedVenues: 0,
              geocodedVenues: 0,
              durationMs: 10,
            };
          });

        const result = await service.retryFailed();

        expect(syncLeagueSpy).toHaveBeenCalledTimes(1);
        expect(syncLeagueSpy).toHaveBeenCalledWith(53941, {
          verbandId: 1,
          leagueName: 'Kreisliga A',
        });
        expect(result.retriedCount).toBe(1);
        expect(result.resolvedCount).toBe(1);
        expect(result.stillFailingCount).toBe(0);
        expect(result.failures).toEqual([]);
        expect(result.retriedLeagues).toBe(1);
        expect(result.resolved).toBe(1);
        expect(result.stillFailing).toBe(0);
      });

      it('should increment stillFailingCount and keep failure when retried league fails again', async () => {
        fakeDb.existingFailures = [
          {
            id: 1,
            entityType: 'league',
            dbbLeagueId: 99999,
            leagueName: 'Failing Liga',
            dbbMatchId: null,
            verbandId: 1,
            errorMessage: 'Persistent error',
            retryCount: 0,
            failedAt: new Date(),
            updatedAt: new Date(),
          },
        ];

        jest.spyOn(service, 'syncLeague').mockRejectedValue(new Error('Still down'));

        const result = await service.retryFailed();

        expect(result.retriedCount).toBe(1);
        expect(result.resolvedCount).toBe(0);
        expect(result.stillFailingCount).toBe(1);
        expect(result.retriedLeagues).toBe(1);
        expect(result.resolved).toBe(0);
        expect(result.stillFailing).toBe(1);
      });

      it('should throw error if db is not configured', async () => {
        const nullDbModule = await Test.createTestingModule({
          providers: [
            ScraperService,
            { provide: DRIZZLE_DB, useValue: null },
            { provide: DbbClientService, useValue: mockDbbClient },
            { provide: GeocoderService, useValue: mockGeocoder },
          ],
        }).compile();

        const nullDbService = nullDbModule.get<ScraperService>(ScraperService);

        await expect(nullDbService.retryFailed()).rejects.toThrow(
          'Database is not configured!'
        );
      });
    });
  });

  describe('resolveDbbTeamId', () => {
    it('resolves seasonTeamId if available', () => {
      const id = service.resolveDbbTeamId({
        seasonTeamId: 101,
        teamCompetitionId: 202,
        teamPermanentId: 303,
        teamname: 'Team A',
      });

      expect(id).toBe(101);
    });

    it('falls back to teamCompetitionId if seasonTeamId is not present', () => {
      const id = service.resolveDbbTeamId({
        teamCompetitionId: 202,
        teamPermanentId: 303,
        teamname: 'Team B',
      });

      expect(id).toBe(202);
    });

    it('falls back to teamPermanentId if other IDs are not present', () => {
      const id = service.resolveDbbTeamId({
        teamPermanentId: 303,
        teamname: 'Team C',
      });

      expect(id).toBe(303);
    });

    it('returns null when team is null or undefined or IDs are missing', () => {
      expect(service.resolveDbbTeamId(null)).toBeNull();
      expect(service.resolveDbbTeamId(undefined)).toBeNull();
      expect(service.resolveDbbTeamId({ teamname: 'No ID' })).toBeNull();
    });
  });

  describe('persistVenueCoordinates', () => {
    it('persists coordinates and PostGIS point to venue table', async () => {
      fakeDb.existingVenues = [
        {
          id: 777,
          name: 'Sporthalle',
          street: 'Testweg 1',
          postalCode: '70173',
          city: 'Stuttgart',
          latitude: null,
          longitude: null,
          location: null,
          geocodedAt: null,
          rawData: null,
          updatedAt: new Date(),
        },
      ];

      const updated = await service.persistVenueCoordinates(777, {
        latitude: 48.78,
        longitude: 9.18,
      });

      expect(updated).not.toBeNull();
      expect(updated?.latitude).toBe(48.78);
      expect(updated?.longitude).toBe(9.18);
      expect(fakeDb.updateCalls).toHaveLength(1);
      expect(fakeDb.updateCalls[0].values.latitude).toBe(48.78);
      expect(fakeDb.updateCalls[0].values.longitude).toBe(9.18);
      expect(fakeDb.updateCalls[0].values.location).toEqual({ lng: 9.18, lat: 48.78 });
    });
  });
});
