import { Test, TestingModule } from '@nestjs/testing';
import {
  DbbClientService,
  DbbCompetitionActualResponse,
  DbbLigaData,
  DbbWamLigaResponse,
} from './dbb-client.service';

describe('DbbClientService', () => {
  let service: DbbClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbbClientService],
    }).compile();

    service = module.get<DbbClientService>(DbbClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAllWamLeagues', () => {
    it('should paginate through multiple pages until hasMoreData is false', async () => {
      const page1Leagues: DbbLigaData[] = [
        { ligaId: 101, liganame: 'Oberliga 1' },
        { ligaId: 102, liganame: 'Oberliga 2' },
      ];

      const page2Leagues: DbbLigaData[] = [
        { ligaId: 103, liganame: 'Landesliga 1' },
      ];

      const fetchWamSpy = jest
        .spyOn(service, 'fetchWamLeagues')
        .mockImplementation(async (_verbandId: number, startAtIndex: number): Promise<DbbWamLigaResponse> => {
          if (startAtIndex === 0) {
            return {
              data: {
                startAtIndex: 0,
                hasMoreData: true,
                size: 2,
                ligen: page1Leagues,
              },
            };
          }

          return {
            data: {
              startAtIndex: 2,
              hasMoreData: false,
              size: 1,
              ligen: page2Leagues,
            },
          };
        });

      const result = await service.fetchAllWamLeagues(1);

      expect(fetchWamSpy).toHaveBeenCalledTimes(2);
      expect(fetchWamSpy).toHaveBeenNthCalledWith(1, 1, 0);
      expect(fetchWamSpy).toHaveBeenNthCalledWith(2, 1, 2);
      expect(result).toHaveLength(3);
      expect(result[0].ligaId).toBe(101);
      expect(result[1].ligaId).toBe(102);
      expect(result[2].ligaId).toBe(103);
    });

    it('should stop immediately if a page returns empty ligen', async () => {
      jest
        .spyOn(service, 'fetchWamLeagues')
        .mockImplementation(async (): Promise<DbbWamLigaResponse> => ({
          data: {
            startAtIndex: 0,
            hasMoreData: true,
            size: 0,
            ligen: [],
          },
        }));

      const result = await service.fetchAllWamLeagues(1);

      expect(result).toHaveLength(0);
    });
  });

  describe('fetchCompetitionActual', () => {
    let fetchSpy: jest.SpyInstance;

    const mockActualResponse: DbbCompetitionActualResponse = {
      status: '0',
      message: '',
      data: {
        ligaData: {
          seasonId: 2026,
          seasonName: '2026/2027',
          ligaId: 52539,
          liganame: 'Regionalliga Baden-Württemberg Frauen',
          liganr: 7010,
        },
        matches: [
          {
            matchId: 2915168,
            matchDay: 5,
            matchNo: 26,
            kickoffDate: '2026-10-10',
            kickoffTime: '15:45',
            homeTeam: {
              seasonTeamId: 437294,
              teamname: 'SV03 Tigers Tübingen',
            },
            guestTeam: {
              seasonTeamId: 437298,
              teamname: 'USC Freiburg 3',
            },
            result: '67:49',
            ergebnisbestaetigt: true,
          },
        ],
        tabelle: {
          entries: [
            {
              rang: 1,
              team: {
                seasonTeamId: 437299,
                teamname: 'USC Heidelberg 2',
              },
              anzspiele: 4,
              anzGewinnpunkte: 8,
              anzVerlustpunkte: 0,
              s: 4,
              n: 0,
              koerbe: 349,
              gegenKoerbe: 164,
              korbdiff: 185,
            },
          ],
        },
        kreuztabelle: null,
        teamStatistik: null,
      },
    };

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('should query /rest/competition/number/{liganr}/actual with default rangeDays=14', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockActualResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.fetchCompetitionActual(7010);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.basketball-bund.net/rest/competition/number/7010/actual?rangeDays=14',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json, text/plain, */*',
          }),
        })
      );
      expect(result).toEqual(mockActualResponse);
      expect(result.data.matches).toHaveLength(1);
      expect(result.data.tabelle.entries).toHaveLength(1);
    });

    it('should query with custom rangeDays parameter', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockActualResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await service.fetchCompetitionActual(7010, 7);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.basketball-bund.net/rest/competition/number/7010/actual?rangeDays=7',
        expect.anything()
      );
      expect(result).toEqual(mockActualResponse);
    });

    it('should throw an informative error when the DBB API returns a non-200 status', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        })
      );

      await expect(service.fetchCompetitionActual(9999)).rejects.toThrow(
        'Failed to fetch competition actual for league 9999: 404 Not Found'
      );
    });
  });
});
